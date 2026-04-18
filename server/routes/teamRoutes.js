const express = require("express");
const router = express.Router();
const {
	addMemberToTeam,
	changeMemberRole,
	assignReviewerToContent,
	removeMemberFromTeam,
	submitReviewDecision,
	revertReviewDecision,
	submitAuthorContentUpdate,
} = require("../controllers/teamController");

router.post("/add-member", addMemberToTeam);
router.post("/change-role", changeMemberRole);
router.post("/assign-reviewer", assignReviewerToContent);
router.post("/review-decision", submitReviewDecision);
router.post("/review-revert", revertReviewDecision);
router.post("/content-update", submitAuthorContentUpdate);
router.post("/remove-member", removeMemberFromTeam);

module.exports = router;