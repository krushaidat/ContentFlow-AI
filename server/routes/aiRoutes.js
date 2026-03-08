const express = require("express");
const router = express.Router();
const { validatePost } = require("../controllers/aiController");

router.post("/validate", validatePost);

module.exports = router;