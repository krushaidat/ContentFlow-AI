console.log("=== SERVER STARTUP ===");
console.log("Loading express...");
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
console.log("✓ Express loaded");

console.log("Loading dotenv...");
require("dotenv").config();
console.log("✓ Dotenv loaded");

console.log("Loading Firebase config...");
const db = require("./config/firebase");
console.log("✓ Firebase loaded");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
console.log("✓ Middleware configured");

// Test route
app.get("/", (req, res) => {
  console.log("GET /");
  res.send("Server running");
});

// Quick health check route
app.get("/api/test", (req, res) => {
  console.log("GET /api/test");
  res.json({ message: "Backend connected successfully" });
});

// Debug endpoint to list all content documents
app.get("/api/debug/content", async (req, res) => {
  console.log("GET /api/debug/content - START");
  try {
    console.log("  -> Querying Firestore content collection");
    const snapshot = await db.collection("content").limit(10).get();
    console.log("  -> Query returned", snapshot.docs.length, "documents");
    
    const content = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "No title",
        text: (data.text ? data.text.substring(0, 100) : "No text") + "...",
        templateId: data.templateId || "No template",
        createdAt: data.createdAt || "No date",
      };
    });
    
    console.log("  -> Returning response with", content.length, "documents");
    res.json({ 
      count: content.length, 
      content,
      message: "These are the most recent content documents in Firestore"
    });
  } catch (error) {
    console.error("  -> ERROR:", error.message);
    res.status(500).json({ error: error.message, details: error.toString() });
  }
});

app.get("/api/templates", async (req, res) => {
  console.log("GET /api/templates");
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


// Routes
const aiRoutes = require("./routes/aiRoutes");
app.use("/api/ai", aiRoutes);
console.log("✓ AI routes loaded");

console.log("Starting server on port", PORT);
app.listen(PORT, () => {
  console.log(`✓✓✓ SERVER RUNNING ON PORT ${PORT} ✓✓✓`);
  console.log(`Try: http://localhost:${PORT}/`);
  console.log(`Try: http://localhost:${PORT}/api/test`);
  console.log(`Try: http://localhost:${PORT}/api/debug/content`);
});

