/**
 * AI Controller — ContentFlow AI (Final)
 * Authors: Tanvir (original), refactored
 */

const db = require("../config/firebase");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configs — each endpoint gets a model with the right JSON schema

const validationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    compliance: { type: SchemaType.BOOLEAN, description: "true if brandScore >= 70 and no missing sections" },
    brandScore: { type: SchemaType.INTEGER, description: "0-100 brand consistency score" },
    missingSections: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Required sections not covered in the content",
    },
    suggestions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Specific actionable improvement suggestions",
    },
  },
  required: ["compliance", "brandScore", "missingSections", "suggestions"],
};

const fixesSchema = {
  type: SchemaType.OBJECT,
  properties: {
    fixedTitle: { type: SchemaType.STRING, description: "Improved title" },
    fixedText: { type: SchemaType.STRING, description: "Full rewritten content" },
    changesSummary: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Brief description of each change",
    },
  },
  required: ["fixedTitle", "fixedText", "changesSummary"],
};

const writingAssistSchema = {
  type: SchemaType.OBJECT,
  properties: {
    suggestions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING, description: "1-2 sentence continuation" },
          label: { type: SchemaType.STRING, description: "2-3 word label" },
        },
        required: ["text", "label"],
      },
    },
  },
  required: ["suggestions"],
};

const schedulingSchema = {
  type: SchemaType.OBJECT,
  properties: {
    suggestedDate: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
    suggestedTime: { type: SchemaType.STRING, description: "HH:MM" },
    reason: { type: SchemaType.STRING, description: "Short explanation" },
  },
  required: ["suggestedDate", "suggestedTime", "reason"],
};

function createModel(schema, maxTokens = 1024) {
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
}

// Request queue — 4s between calls
let queue = Promise.resolve();

function enqueue(fn) {
  queue = queue
    .then(() => new Promise((r) => setTimeout(r, 4000)))
    .then(fn)
    .catch((err) => { throw err; });
  return queue;
}



// Abdalaa: Gemini sometimes returns extra text or half-finished formatting.
// This helper tries a few cleanup steps before giving up.
function safeParseGeminiJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Gemini returned empty response.");
  }

  const trimmed = text.trim();

  if (
    trimmed === "Here is the JSON requested:" ||
    trimmed === "Here is the JSON requested:\n```json" ||
    trimmed.endsWith("```json")
  ) {
    throw new Error("Gemini returned only an intro sentence with no JSON.");
  }

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // Remove markdown fences
  const cleaned = trimmed
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Try extracting the JSON object from inside extra text
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonSlice);
  }

  throw new Error(`Could not parse Gemini JSON. Raw response: ${cleaned}`);
}


async function callWithRetry(model, prompt, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Abdalaa: use safer parsing so Gemini does not fail
      // just because it added a sentence before the JSON.
      return safeParseGeminiJson(text);
    } catch (err) {
      const retryable =
        err?.status === 429 ||
        err?.status === 503 ||
        err?.message?.includes("RESOURCE_EXHAUSTED") ||
        err?.message?.includes("overloaded");

      if (retryable && i < retries) {
        const wait = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        console.warn(`Gemini retry ${i + 1}/${retries}, waiting ${Math.round(wait)}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      throw err;
    }
  }
}

// Queued + retried call
function callGemini(model, prompt) {
  return enqueue(() => callWithRetry(model, prompt));
}

// Build template context — handles all Firestore field variations
function buildTemplateContext(t) {
  if (!t) return "No template. Use general marketing best practices.";

  const lines = [];
  lines.push(`Name: ${t.name || t.title || "Unnamed"}`);

  // requiredSections: could be array or colon/comma-separated string
  let sections = t.requiredSections;
  if (typeof sections === "string") {
    sections = sections.split(/[:,\n]+/).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(sections) && sections.length) {
    lines.push(`Required Sections: ${sections.join(", ")}`);
  }

  const tone = t.toneRules || t.tone;
  if (tone) lines.push(`Tone: ${tone}`);

  const structure = t.structuralRules || t.structure;
  if (structure) lines.push(`Structure: ${structure}`);

  if (t.languageConstraints) lines.push(`Language: ${t.languageConstraints}`);

  return lines.join("\n");
}

// Fetch template helper
async function fetchTemplate(templateId) {
  if (!templateId) return null;
  const doc = await db.collection("templates").doc(templateId).get();
  return doc.exists ? doc.data() : null;
}

// POST /api/ai/validate
exports.validatePost = async (req, res) => {
  try {
    const { postId, templateId } = req.body;
    if (!postId) return res.status(400).json({ error: "postId is required." });

    const postRef = db.collection("content").doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: "Content not found." });

    const post = postDoc.data();
    if (!post?.text) return res.status(400).json({ error: "Content text is empty." });

    const tplId = templateId || post.templateId;
    const tpl = await fetchTemplate(tplId);
    const ctx = buildTemplateContext(tpl);

    const model = createModel(validationSchema, 4096);

    const prompt = `Validate this marketing content against the template guidelines.

GUIDELINES:
${ctx}

CONTENT:
Title: "${post.title || "Untitled"}"
"${post.text}"

Rules: compliance=true only if brandScore>=70 and missingSections is empty. Placeholders don't count as covered.`;

    const result = await callGemini(model, prompt);

    const validation = {
      compliance: Boolean(result.compliance),
      brandScore: Number(result.brandScore) || 0,
      suggestions: result.suggestions || [],
      missingSections: result.missingSections || [],
      templateUsed: tplId || "none",
      validatedAt: new Date().toISOString(),
    };

    await postRef.update({ validation, updatedAt: new Date().toISOString() });
    return res.json({ success: true, validation });
  } catch (err) {
    console.error("Validation failed:", err.message);
    return res.status(500).json({ error: "Validation failed. Try again shortly.", details: err.message });
  }
};

// POST /api/ai/apply-fixes
exports.applyFixes = async (req, res) => {
  try {
    const { postId, templateId } = req.body;
    if (!postId) return res.status(400).json({ error: "postId is required." });

    const postRef = db.collection("content").doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: "Content not found." });

    const post = postDoc.data();
    if (!post?.text) return res.status(400).json({ error: "Content text is empty." });

    const tplId = templateId || post.templateId;
    const tpl = await fetchTemplate(tplId);
    const ctx = buildTemplateContext(tpl);
    const issues = post.validation?.suggestions || [];

    const model = createModel(fixesSchema, 8192);

    const prompt = `Rewrite this content to fully satisfy the template guidelines. Preserve the author's intent.

GUIDELINES:
${ctx}

ORIGINAL:
Title: "${post.title || "Untitled"}"
"${post.text}"

ISSUES TO FIX:
${issues.length ? issues.join("; ") : "Improve based on guidelines."}`;

    const result = await callGemini(model, prompt);

    await postRef.update({
      title: result.fixedTitle || post.title,
      text: result.fixedText || post.text,
      lastFixedAt: new Date().toISOString(),
      fixChangesSummary: result.changesSummary || [],
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      success: true,
      fixedTitle: result.fixedTitle || post.title,
      fixedText: result.fixedText || post.text,
      changesSummary: result.changesSummary || [],
    });
  } catch (err) {
    console.error("Apply fixes failed:", err.message);
    return res.status(500).json({ error: "Could not apply fixes. Try again shortly.", details: err.message });
  }
};

// POST /api/ai/writing-assist
exports.writingAssist = async (req, res) => {
  try {
    const { currentText, templateId } = req.body;
    if (!currentText || currentText.trim().length < 10) {
      return res.status(400).json({ error: "Provide at least 10 characters." });
    }

    const tpl = await fetchTemplate(templateId);
    const ctx = buildTemplateContext(tpl);

    const model = createModel(writingAssistSchema, 2048);

    const prompt = `Suggest 3 short continuations (1-2 sentences each) for this marketing draft. Match the template tone.

TEMPLATE: ${ctx}

DRAFT SO FAR:
"${currentText}"`;

    const result = await callGemini(model, prompt);
    return res.json({ success: true, suggestions: result.suggestions || [] });
  } catch (err) {
    console.error("Writing assist failed:", err.message);
    return res.status(500).json({ error: "Writing assist unavailable.", details: err.message });
  }
};

// Abdalaa: build a realistic set of candidate slots for AI scheduling.
// Gemini should choose from these free slots instead of inventing its own.
function buildCandidateSlots(rangeDays = 3) {
  const candidateTimes = ["09:00", "11:00", "14:00", "16:00", "18:00"];
  const slots = [];
  const today = new Date();

  for (let i = 0; i < Number(rangeDays); i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const dateStr = d.toISOString().split("T")[0];

    for (const time of candidateTimes) {
      slots.push(`${dateStr} ${time}`);
    }
  }

  return slots;

}
// Abdalaa: remove already occupied slots so AI only sees real free options.
function filterFreeSlots(candidateSlots, occupiedSlots) {
  const occupiedSet = new Set(
    occupiedSlots.map((slot) => `${slot.date} ${slot.time}`)
  );

  return candidateSlots.filter((slot) => !occupiedSet.has(slot));
}


// Abdalaa: AI scheduling should pick one real free slot from a prepared list.

exports.suggestPostTime = async (req, res) => {
  try {
    const { postId, userId, rangeDays = 3 } = req.body;

    if (!postId || !userId) {
      return res.status(400).json({ error: "postId and userId required." });
    }

    const postDoc = await db.collection("content").doc(postId).get();
    if (!postDoc.exists) {
      return res.status(404).json({ error: "Content not found." });
    }

    const post = postDoc.data();

    const slotsSnapshot = await db
      .collection("calendarSlots")
      .where("userId", "==", userId)
      .get();

    const occupied = slotsSnapshot.docs.map((d) => d.data());

    const candidateSlots = buildCandidateSlots(rangeDays);
    const freeSlots = filterFreeSlots(candidateSlots, occupied);

    if (freeSlots.length === 0) {
      return res.status(400).json({
        error: "No free scheduling slots found in the selected range.",
      });
    }

    const freeSlotsText = freeSlots.join(", ");

    let result;
    let usedFallback = false;

    try {
      const prompt = `
Return ONLY raw JSON.
No markdown.
No explanation.
No code fences.

Format:
{"chosenSlot":"YYYY-MM-DD HH:MM","reason":"Short explanation"}

Post title: "${post.title || "Untitled"}"
Post content: "${post.text || ""}"

Choose exactly one slot from this list:
${freeSlotsText}
      `.trim();

      const rawResult = await genAI
        .getGenerativeModel({ model: "gemini-2.5-flash" })
        .generateContent(prompt);

      const rawText = rawResult.response.text();

      console.log(" debug - raw Gemini scheduling text:", rawText);

      const parsed = safeParseGeminiJson(rawText);

      if (!parsed.chosenSlot || !freeSlots.includes(parsed.chosenSlot)) {
        throw new Error("Gemini chose an invalid or unavailable slot.");
      }

      const [suggestedDate, suggestedTime] = parsed.chosenSlot.split(" ");

      result = {
        suggestedDate,
        suggestedTime,
        reason: parsed.reason || "Chosen by Gemini from the available free slots.",
      };
    } catch (err) {
      console.warn("Gemini scheduling fallback:", err.message);
      usedFallback = true;

      // Abdalaa: if Gemini fails still schedule the first free slot
      // so the feature stays useful instead of failing completely.
      const [fallbackDate, fallbackTime] = freeSlots[0].split(" ");

      result = {
        suggestedDate: fallbackDate,
        suggestedTime: fallbackTime,
        reason: "Fallback — first available free slot was used.",
      };
    }

    await db.collection("calendarSlots").add({
      userId,
      postId,
      title: post.title || "Untitled",
      date: result.suggestedDate,
      time: result.suggestedTime,
      reason: result.reason,
      slotStatus: "scheduled",
      createdAt: new Date(),
      rangeDays: Number(rangeDays),
    });

    if (!usedFallback) {
      await db.collection("aiSuggestions").add({
        userId,
        postId,
        title: post.title || "Untitled",
        reason: result.reason,
        suggestedDate: result.suggestedDate,
        suggestedTime: result.suggestedTime,
        status: "idea",
        createdAt: new Date(),
        rangeDays: Number(rangeDays),
      });
    }

    return res.json({
      success: true,
      ...result,
      source: usedFallback ? "fallback" : "gemini",
    });
  } catch (err) {
    console.error("Suggest post time error:", err);
    return res.status(500).json({
      error: "Failed to suggest time.",
      details: err.message,
    });
  }
};


// Abdalaa manual scheduling should allow any date/time the user wants
// I also added repeat support so one action can create multiple future slots.
exports.manualSchedulePost = async (req, res) => {
  try {
    const {
      postId,
      userId,
      date,
      time,
      repeatType = "none",
      repeatCount = 1,
    } = req.body;

    if (!postId || !userId || !date || !time) {
      return res.status(400).json({
        error: "postId, userId, date, and time required.",
      });
    }

    const postDoc = await db.collection("content").doc(postId).get();
    if (!postDoc.exists) {
      return res.status(404).json({ error: "Content not found." });
    }

    const postTitle = postDoc.data().title || "Untitled";

    // Abdalaa: save the first scheduled slot
    await db.collection("calendarSlots").add({
      userId,
      postId,
      title: postTitle,
      date,
      time,
      reason: "Scheduled manually.",
      slotStatus: "scheduled",
      createdAt: new Date(),
      repeatType,
      repeatCount: Number(repeatCount),
    });

    // Abdalaa: if repeat is enabled, create extra future slots too.
    if (repeatType !== "none" && Number(repeatCount) > 1) {
      const baseDate = new Date(date);

      for (let i = 1; i < Number(repeatCount); i++) {
        const nextDate = new Date(baseDate);

        if (repeatType === "daily") {
          nextDate.setDate(baseDate.getDate() + i);
        } else if (repeatType === "weekly") {
          nextDate.setDate(baseDate.getDate() + i * 7);
        } else if (repeatType === "monthly") {
          nextDate.setMonth(baseDate.getMonth() + i);
        }

        const nextDateStr = nextDate.toISOString().split("T")[0];

        await db.collection("calendarSlots").add({
          userId,
          postId,
          title: postTitle,
          date: nextDateStr,
          time,
          reason: `Repeated ${repeatType} schedule.`,
          slotStatus: "scheduled",
          createdAt: new Date(),
          repeatType,
          repeatCount: Number(repeatCount),
        });
      }
    }

    return res.json({
      success: true,
      date,
      time,
    });
  } catch (err) {
    console.error("Manual schedule error:", err);
    return res.status(500).json({
      error: "Failed to schedule.",
      details: err.message,
    });
  }
};