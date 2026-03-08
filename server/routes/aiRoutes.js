const express = require("express");
const router = express.Router();
const { validatePost, suggestPostTime } = require("../controllers/aiController");

router.post("/validate", validatePost);
router.post("/suggest-post-time", suggestPostTime);

module.exports = router;