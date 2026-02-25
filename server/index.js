const db = require("./config/firebase");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Important for reading JSON body

// Test route
app.get("/", (req, res) => {
  res.send("Server running");
});

const PORT = process.env.PORT || 5000;

// Abdalaa: Create the Gemini client using the key in server/.env
const ai = new GoogleGenAI({ apiKey: process.env.AIzaSyBWJRwrY9N9C8zBs8XxcK_hiczt0amajdc });

// Quick health check route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend connected successfully ✅" });
});

/**
 * POST /api/ai/validate
 * Body: { title, text, stage }
 * Returns: { brandScore, summary, issues, suggestions, raw }
 */
app.post("/api/ai/validate", async (req, res) => {
  try {
    const { title = "", text = "", stage = "" } = req.body || {};

    // abdalaa: basic safety checks
    if (!text.trim()) {
      return res.status(400).json({ error: "Missing text to validate." });
    }

    // Abdalaa: We forc Gemini to output JsON only.
  
    const prompt = `
You are a content quality validator for a marketing workflow app.


Return ONLY valid JSON (no markdown, no extra text).
Use this exact schema:

{
  "brandScore": number, 
  "summary": string,
  "issues": [
    { "type": string, "message": string }
  ],
  "suggestions": [ string ]
}

Rules:
- brandScore must be 0..100

- issues can be empty []
- suggestions can be empty []
- Keep it concise and practical.

Content:
Title: ${title}
Stage: ${stage}
Text: ${text}
`;

    // Pick a model that exists in the current gemeni docs 
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    // Abdalaa: response.text is the best way to get the output
    const raw = response.text || "";

    // Try to paste JSON
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (jsonErr) {
      // if gemeni returns something not JsON return raw so i can debug
      return res.status(200).json({
        brandScore: null,
        summary: "Gemini returned non-JSON output. Check `raw` for details.",
        issues: [{ type: "format", message: "Gemini response was not valid JSON." }],
        suggestions: [],
        raw,
      });
    }

    // Abdalaa final cleanup 
    const result = {
      brandScore:
  typeof parsed.brandScore === "number"
    ? Math.max(0, Math.min(100, Math.round(parsed.brandScore)))
    : null,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      raw, // keep raw for debugging
    };

    return res.json(result);
  } catch (err) {
    console.error("AI validate backend error:", err);
    return res.status(500).json({
      error: err?.message || "Server error while validating with Gemini.",
    });
  }
});

app.get("/api/templates", async (req, res) => {
  try {
    const snapshot = await db.collection("templates").get();

    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

// Routes
const aiRoutes = require("./routes/aiRoutes");
app.use("/api/ai", aiRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});