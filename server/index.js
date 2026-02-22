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

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend connected successfully" });
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

