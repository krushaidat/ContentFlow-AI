const express = require("express");
const cors = require("cors");
require("dotenv").config();

const PORT = process.env.PORT || 5000;
const db = require("./config/firebase");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (_req, res) => res.send("ContentFlow AI server running"));

app.get("/api/test", (_req, res) =>
  res.json({ message: "Backend connected successfully" })
);

// Debug: list content documents (dev only)
app.get("/api/debug/content", async (_req, res) => {
  try {
    const snapshot = await db.collection("content").limit(10).get();
    const content = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "No title",
        text: data.text ? data.text.substring(0, 100) + "..." : "No text",
        templateId: data.templateId || "No template",
        createdAt: data.createdAt || "No date",
      };
    });
    res.json({ count: content.length, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Templates endpoint — used by the workflow page template dropdown
app.get("/api/templates", async (_req, res) => {
  try {
    const snapshot = await db.collection("templates").get();
    const templates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes
const aiRoutes = require("./routes/aiRoutes");
app.use("/api/ai", aiRoutes);

const teamRoutes = require("./routes/teamRoutes");
app.use("/api/team", teamRoutes);

app.listen(PORT, () => {
  console.log(`ContentFlow AI server running on port ${PORT}`);
});