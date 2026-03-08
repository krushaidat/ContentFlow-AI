const express = require("express");
const router = express.Router();
const { addMemberToTeam, changeMemberRole, assignReviewerToContent } = require("../controllers/teamController");

router.post("/add-member", addMemberToTeam);
router.post("/change-role", changeMemberRole);
router.post("/assign-reviewer", assignReviewerToContent);

module.exports = router;
