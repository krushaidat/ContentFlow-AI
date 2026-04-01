const express = require("express");
const router = express.Router();
const {
  validatePost,
  applyFixes,
  writingAssist,
  suggestPostTime,
  manualSchedulePost,
} = require("../controllers/aiController");

router.post("/validate", validatePost);
router.post("/apply-fixes", applyFixes);
router.post("/writing-assist", writingAssist);
router.post("/suggest-post-time", suggestPostTime);
router.post("/manual-schedule", manualSchedulePost);

module.exports = router;