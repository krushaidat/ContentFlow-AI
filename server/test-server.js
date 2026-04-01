console.log("Test server starting...");
console.log("Current directory:", process.cwd());
console.log("Node version:", process.version);

try {
  console.log("Requiring express...");
  const express = require("express");
  console.log("✓ Express loaded");
  
  console.log("Requiring firebase config...");
  const { db } = require("./config/firebase");
  console.log("✓ Firebase config loaded");
  
  console.log("Creating app...");
  const app = express();
  console.log("✓ App created");
  
  app.get("/test", (req, res) => {
    res.json({ message: "test works" });
  });
  
  app.get("/api/debug/content", async (req, res) => {
    try {
      console.log("Fetching content...");
      const snapshot = await db.collection("content").limit(5).get();
      console.log("Found", snapshot.docs.length, "docs");
      const content = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title
      }));
      res.json({ count: content.length, content });
    } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  
  const PORT = 5000;
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log("Try: http://localhost:5000/test");
    console.log("Try: http://localhost:5000/api/debug/content");
  });
} catch (error) {
  console.error("FATAL ERROR:", error.message);
  console.error(error.stack);
  process.exit(1);
}
