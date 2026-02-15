const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Server running");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend connected successfully" });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
