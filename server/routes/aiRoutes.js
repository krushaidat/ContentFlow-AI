const express = require("express");
const router = express.Router();
const { validatePost, suggestPostTime, manualSchedulePost} = require("../controllers/aiController");

router.post("/validate", validatePost);
router.post("/suggest-post-time", suggestPostTime);

router.post("/manual-schedule", manualSchedulePost);
module.exports = router;

