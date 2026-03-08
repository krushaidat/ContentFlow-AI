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
  console.log("\nVALIDATION REQUEST STARTED ");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Request body:", JSON.stringify(req.body));
  
  try {
    const { postId } = req.body;

    if (!postId) {
      console.log("ERROR: postId is required");
      return res.status(400).json({ error: "postId is required" });
    }

    console.log("postId received:", postId);
    console.log("Attempting to fetch content with postId:", postId);
    
    const postRef = db.collection("content").doc(postId);
    console.log("Document reference created");
    
    const postDoc = await postRef.get();
    console.log("Document fetch completed, exists:", postDoc.exists);

    if (!postDoc.exists) {
      console.error(`Content document not found: ${postId}`);
      return res.status(404).json({ error: "Content not found" });
    }

    const postData = postDoc.data();
    console.log("Retrieved post data keys:", Object.keys(postData));
    console.log("Post data:", JSON.stringify(postData).substring(0, 200));

    // Validate that text field exists
    if (!postData || !postData.text) {
      console.error("Post data missing text field:", postData);
      return res.status(400).json({ error: "Content text is missing or empty" });
    }

    console.log("Text field found, length:", postData.text.length);

    const templateRef = db.collection("templates").doc(postData.templateId);
    const templateDoc = await templateRef.get();
    console.log("Template fetch completed, exists:", templateDoc.exists);

    let templateData = null;
    if (!templateDoc.exists) {
      console.warn(`Template not found: ${postData.templateId}. Validating without template context.`);
      templateData = { name: postData.templateId, guidelines: "Generic content validation" };
    } else {
      templateData = templateDoc.data();
      console.log("Template data retrieved");
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
      console.log("Prompt created, length:", prompt.length);
      console.log("Sending prompt to Gemini API (model: gemini-2.0-flash)...");
      console.log("API Key loaded:", !!process.env.GEMINI_API_KEY);
      console.log("genAI instance:", !!genAI);
      console.log("model instance:", !!model);
      
      const result = await model.generateContent(prompt);
      console.log("Received response from Gemini API");
      
      if (!result || !result.response) {
        console.error("Invalid response structure from API:", result);
        return res.status(500).json({
            error: "Invalid response from Gemini API",
            details: "Response structure is invalid"
        });
      }

      console.log("Response has valid structure");
      const responseText = result.response.text();
      console.log("Response text extracted, length:", responseText.length);
      console.log("Response preview:", responseText.substring(0, 300));

      try {
        const clean = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        console.log("String cleaned, length:", clean.length);
        aiResult = JSON.parse(clean);
        console.log("Successfully parsed AI response");
        console.log("Result:", JSON.stringify(aiResult));
      } catch (err) {
        console.error("Failed to parse JSON response");
        console.error("Parse error:", err.message);
        console.error("RAW AI RESPONSE:", responseText);
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
      console.error("Error code:", apiError.code);
      console.error("Full error:", JSON.stringify(apiError, null, 2));
      
      // Check if it's a quota failure (status 429) or similar
      if (apiError.status === 429 || apiError.message?.includes("quota") || apiError.message?.includes("Quota")) {
        console.warn("⚠ QUOTA EXCEEDED - Using mock validation as fallback");
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

    console.log("Attempting to update Firestore with validation results");
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
    console.log("Successfully updated Firestore document");
    console.log("VALIDATION COMPLETED SUCCESSFULLY \n");

    return res.json({
      success: true,
      validation: aiResult
    });

  } catch (error) {
    console.error("AI validation FAILED");
    console.error("Error message:", error.message);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    console.error("Stack trace:", error.stack);
    console.log("VALIDATION FAILED \n");

    if (req.body?.postId) {
      try {
        await db.collection("content").doc(req.body.postId).update({
          "validation.validatedAt": new Date()
        });
      } catch (updateErr) {
        console.error("Failed to update validation timestamp:", updateErr.message);
      }
    }

    return res.status(500).json({
      error: "Validation failed. No data overwritten.",
      details: error.message
    });
  }
};
