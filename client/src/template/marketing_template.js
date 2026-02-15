export const universalSocialTemplate = {
    name: "Universal Social Post Template",
    version: 1,
  
    fields: {
      goal: "engagement",
      audience: "",
      topic: "",
      hook: "",
      value: "",
      details: "",
      callToAction: "",
      tone: "friendly",
      emojis: "light",
      hashtags: ""
    },
  
    options: {
      goal: ["awareness", "engagement", "leads", "sales", "community"],
      tone: ["friendly", "professional", "bold", "educational", "story"],
      emojis: ["none", "light", "a-lot"]
    },
  
    checklist: [
      { id: "audience", text: "Audience is specific (not 'everyone')" },
      { id: "hook", text: "Hook is clear and interesting" },
      { id: "value", text: "Main value is clear (what do they get?)" },
      { id: "details", text: "Details are short and scannable" },
      { id: "cta", text: "One clear call-to-action" },
      { id: "clean", text: "Not too long, not too salesy" },
      { id: "tags", text: "Hashtags are relevant and not too many" }
    ],
  
    tips: {
      awareness: ["Keep it simple", "Focus on the main idea", "Avoid too many details"],
      engagement: ["Ask a question", "Give 1–2 useful points", "Invite comments"],
      leads: ["Explain who it’s for", "Say what problem you solve", "CTA should be DM or link"],
      sales: ["Benefit first", "Offer + urgency (optional)", "CTA should be clear"],
      community: ["Talk like a human", "Share progress or story", "Invite people to join"]
    },
  
    buildPost(data) {
      const d = { ...this.fields, ...data };
  
      const clean = (s) => (s || "").trim();
      const firstLine = (s) => clean(s).split("\n").find(Boolean) || "";
      const toBullets = (text, max = 4) =>
        clean(text)
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, max)
          .map((x) => `- ${x}`)
          .join("\n");
  
      const emoji = (type) => {
        if (type === "none") return "";
        if (type === "a-lot") return "🔥 ";
        return "✨ ";
      };
  
      const audienceLine = d.audience ? `For ${clean(d.audience)}:` : "";
      const topicLine = d.topic ? `Topic: ${clean(d.topic)}` : "";
  
      const hookLine = clean(d.hook) || firstLine(d.value) || "Quick thought:";
      const valueLine = clean(d.value);
      const bullets = toBullets(d.details, 5);
      const detailsBlock = bullets ? `\n\n${bullets}` : clean(d.details) ? `\n\n${clean(d.details)}` : "";
  
      const ctaLine = clean(d.callToAction) ? `\n\nNext step: ${clean(d.callToAction)}` : "";
  
      const tags = clean(d.hashtags)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((x) => (x.startsWith("#") ? x : `#${x.replace(/\s+/g, "")}`))
        .join(" ");
  
      const tagsBlock = tags ? `\n\n${tags}` : "";
      const toneTag = d.tone ? `\n\n(${d.tone})` : "";
  
      const headerParts = [audienceLine, topicLine].filter(Boolean).join("\n");
  
      const result =
        `${headerParts ? headerParts + "\n\n" : ""}` +
        `${emoji(d.emojis)}${hookLine}\n\n` +
        `${valueLine}` +
        `${detailsBlock}` +
        `${ctaLine}` +
        `${toneTag}` +
        `${tagsBlock}`;
  
      return result.trim();
    },
  
    quickScore(data) {
      const d = { ...this.fields, ...data };
  
      const ok = (s) => (s || "").trim().length > 0;
  
      const checks = {
        audience: ok(d.audience),
        hook: ok(d.hook) || ok(d.value),
        value: ok(d.value),
        details: ok(d.details) || (d.value || "").length > 30,
        cta: ok(d.callToAction),
        clean: (this.buildPost(d).length <= 1200),
        tags: (d.hashtags || "").split(",").filter(Boolean).length <= 6
      };
  
      const total = Object.keys(checks).length;
      const passed = Object.values(checks).filter(Boolean).length;
  
      return { passed, total, checks };
    }
  };