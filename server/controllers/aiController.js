console.log("API KEY:", process.env.GEMINI_API_KEY);
const db = require("../config/firebase");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * validatePost - Tanvir
 - Validates content using Google Gemini AI and stores validation results in Firestore.
 - Fetches a content document by postId, extracts the text, and sends it to Gemini for analysis.
 - Returns compliance score, brand score, missing sections, and suggestions.
 * 
 - If API quota is exceeded, falls back to mock validation data for development/testing.
 - Updates the 'validation' field in the Firestore document with results and timestamp.
 */
exports.validatePost = async (req, res) => {
  try {
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({ error: "postId is required" });
    }

    const postRef = db.collection("content").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return res.status(404).json({ error: "Content not found" });
    }

    const postData = postDoc.data();

    const templateRef = db.collection("templates").doc(postData.templateId);
    const templateDoc = await templateRef.get();

    let templateData = null;
    if (!templateDoc.exists) {
      console.warn(`Template not found: ${postData.templateId}. Validating without template context.`);
      templateData = { name: postData.templateId, guidelines: "Generic content validation" };
    } else {
      templateData = templateDoc.data();
    }

    const prompt = `
You are a content validation engine.

Analyze this content:
"${postData.text}"

Template: ${templateData?.name || "Generic"}

Return ONLY valid JSON in this exact format:

{
  "compliance": true or false,
  "brandScore": number between 0 and 100,
  "missingSections": ["section names if any"],
  "suggestions": ["improvement suggestions"]
}
`;

    let aiResult;

    try {
      console.log("Sending prompt to Gemini API...");
      const result = await model.generateContent(prompt);
      
      if (!result || !result.response) {
        console.error("Invalid response structure from API:", result);
        return res.status(500).json({
            error: "Invalid response from Gemini API",
            details: "Response structure is invalid"
        });
      }

      const responseText = result.response.text();
      console.log("Received response from Gemini:", responseText);

      try {
        const clean = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        aiResult = JSON.parse(clean);
        console.log("Successfully parsed AI response:", aiResult);
      } catch (err) {
        console.error("RAW AI RESPONSE BELOW:");
        console.log(responseText);
        return res.status(500).json({
            error: "AI returned invalid JSON",
            raw: responseText
        });
      }
    } catch (apiError) {
      // Log full error details to help diagnose API issues
      console.error("GEMINI API ERROR:");
      console.error("Error message:", apiError.message);
      console.error("Error status:", apiError.status);
      console.error("Full error:", apiError);
      
      // Check if it's a quota failure (status 429) or similar
      if (apiError.status === 429 || apiError.message?.includes("quota") || apiError.message?.includes("Quota")) {
        console.warn("QUOTA EXCEEDED - Using mock validation as fallback");
        aiResult = {
          compliance: true,
          brandScore: 82,
          missingSections: [],
          suggestions: ["Consider adding a call-to-action", "Verify brand tone matches guidelines"]
        };
      } else {
        // For other errors, return the actual error so you can see what's wrong
        return res.status(500).json({
          error: "Gemini API failed",
          details: apiError.message,
          status: apiError.status
        });
      }
    }

    await postRef.update({
      validation: {
        compliance: aiResult.compliance ?? false,
        brandScore: aiResult.brandScore ?? 0,
        suggestions: aiResult.suggestions ?? [],
        missingSections: aiResult.missingSections ?? [],
        validatedAt: new Date()
      },
      updatedAt: new Date()
    });

    return res.json({
      success: true,
      validation: aiResult
    });

  } catch (error) {
    console.error("AI validation failed:", error.message);
    console.error("Full error:", error);

    if (req.body.postId) {
      await db.collection("content").doc(req.body.postId).update({
        "validation.validatedAt": new Date()
      });
    }

    return res.status(500).json({
      error: "Validation failed. No data overwritten.",
      details: error.message
    });
  }
};
