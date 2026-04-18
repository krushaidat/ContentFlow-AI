const { db } = require("../config/firebase");
const admin = require("firebase-admin");
const { createNotification, buildDisplayName } = require("../utils/notificationService");

const normalizeStageValue = (value) => String(value || "").trim().toLowerCase();

/**
 * Review status
 *   ASSIGNED → newly assigned to reviewer (no decision yet)
 *   APPROVED → approved by reviewer
 *   REJECTED → rejected with feedback
 */
const REVIEW_STATUS = Object.freeze({
  ASSIGNED: "ASSIGNED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

async function findAutoReviewerForTeam(teamId, excludeUserId = null) {
  if (!teamId) {
    return null;
  }

  const teamUsersSnapshot = await db
    .collection("Users")
    .where("teamId", "==", teamId)
    .get();

  const reviewers = teamUsersSnapshot.docs
    .map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }))
    .filter(
      (member) => member.id !== excludeUserId && member.role === "reviewer"
    );

  if (reviewers.length === 0) {
    return null;
  }

  const availableReviewers = reviewers.filter(
    (reviewer) => reviewer.isAvailable !== false
  );
  const reviewerPool = availableReviewers.length > 0 ? availableReviewers : reviewers;

  const reviewersWithLoad = await Promise.all(
    reviewerPool.map(async (reviewer) => {
      const assignedSnapshot = await db
        .collection("content")
        .where("reviewerId", "==", reviewer.id)
        .get();

      const currentLoad = assignedSnapshot.docs.filter((contentDoc) => {
        const assignedContent = contentDoc.data() || {};
        const assignedStage = normalizeStageValue(assignedContent.stage);
        const reviewStatus = normalizeStageValue(assignedContent.reviewStatus);

        return (
          assignedStage === "review" ||
          assignedStage === "update" ||
          !["approved", "rejected"].includes(reviewStatus)
        );
      }).length;

      return {
        ...reviewer,
        currentLoad,
      };
    })
  );

  reviewersWithLoad.sort((a, b) => {
    const loadDiff = Number(a.currentLoad || 0) - Number(b.currentLoad || 0);
    if (loadDiff !== 0) {
      return loadDiff;
    }
    return String(a.id).localeCompare(String(b.id));
  });

  return reviewersWithLoad[0] || null;
}

/**
 * addMemberToTeam - Server-side team member addition
 * Only allows admins to add members to their team
 * Takes an admin ID token for verification, then adds the member to the Firestore Users collection
 */
exports.addMemberToTeam = async (req, res) => {
  console.log("POST /api/team/add-member - START");
  console.log("Request body:", JSON.stringify(req.body));

  try {
    const { adminId, memberEmail, teamId } = req.body;

    if (!adminId || !memberEmail || !teamId) {
      console.log("ERROR: Missing required fields");
      return res.status(400).json({ error: "adminId, memberEmail, and teamId are required" });
    }

    console.log("Verifying admin status for user:", adminId);
    const adminRef = db.collection("Users").doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      console.log("ERROR: Admin user not found");
      return res.status(404).json({ error: "Admin user not found" });
    }

    const adminData = adminDoc.data();
    if (adminData.role !== "admin") {
      console.log("ERROR: User is not an admin, role:", adminData.role);
      return res.status(403).json({ error: "Only admins can add team members" });
    }

    if (adminData.teamId !== teamId) {
      console.log("ERROR: Admin does not have access to this team");
      return res.status(403).json({ error: "Admin does not have access to this team" });
    }

    console.log("Finding user with email:", memberEmail.toLowerCase());
    const memberQuery = await db
      .collection("Users")
      .where("email", "==", memberEmail.toLowerCase())
      .get();

    if (memberQuery.empty) {
      console.log("ERROR: No user found with email:", memberEmail);
      return res.status(404).json({ error: "No user found with that email" });
    }

    const memberDoc = memberQuery.docs[0];
    const memberId = memberDoc.id;
    console.log("Found user:", memberId);

    console.log("Adding user to team:", teamId);
    await db.collection("Users").doc(memberId).update({
      teamId: teamId,
    });

    console.log("SUCCESS: Member added to team");
    res.json({
      success: true,
      message: "Member added to team successfully",
      memberId: memberId,
      memberEmail: memberEmail,
    });
  } catch (error) {
    console.error("ERROR in addMemberToTeam:", error);
    res.status(500).json({ error: error.message || "Failed to add member to team" });
  }
};

/**
 * changeMemberRole - Server-side role change
 * Only allows admins to change roles of their team members
 * Validates admin ownership and prevents unauthorized role changes
 */
exports.changeMemberRole = async (req, res) => {
  console.log("POST /api/team/change-role - START");
  console.log("Request body:", JSON.stringify(req.body));

  try {
    const { adminId, memberId, newRole, teamId } = req.body;

    if (!adminId || !memberId || !newRole || !teamId) {
      console.log("ERROR: Missing required fields");
      return res.status(400).json({ error: "adminId, memberId, newRole, and teamId are required" });
    }

    const validRoles = ["user", "author", "reviewer", "admin"];
    if (!validRoles.includes(newRole)) {
      console.log("ERROR: Invalid role:", newRole);
      return res.status(400).json({ error: "Invalid role. Must be one of: user, author, reviewer, admin" });
    }

    console.log("Verifying admin status for user:", adminId);
    const adminRef = db.collection("Users").doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      console.log("ERROR: Admin user not found");
      return res.status(404).json({ error: "Admin user not found" });
    }

    const adminData = adminDoc.data();
    if (adminData.role !== "admin") {
      console.log("ERROR: User is not an admin, role:", adminData.role);
      return res.status(403).json({ error: "Only admins can change member roles" });
    }
    if (adminData.teamId !== teamId) {
      console.log("ERROR: Admin does not have access to this team");
      return res.status(403).json({ error: "Admin does not have access to this team" });
    }

    console.log("Verifying member:", memberId);
    const memberRef = db.collection("Users").doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      console.log("ERROR: Member not found");
      return res.status(404).json({ error: "Member not found" });
    }

    const memberData = memberDoc.data();
    if (memberData.teamId !== teamId) {
      console.log("ERROR: Member does not belong to this team");
      return res.status(403).json({ error: "Member does not belong to this team" });
    }

    console.log("Updating member role to:", newRole);
    await db.collection("Users").doc(memberId).update({
      role: newRole,
    });

    console.log("SUCCESS: Member role updated");
    res.json({
      success: true,
      message: "Member role updated successfully",
      memberId: memberId,
      newRole: newRole,
    });
  } catch (error) {
    console.error("ERROR in changeMemberRole:", error);
    res.status(500).json({ error: error.message || "Failed to change member role" });
  }
};

/**
 * assignReviewerToContent - Server-side reviewer assignment
 * Allows admins to assign a reviewer to a content item
 */
exports.assignReviewerToContent = async (req, res) => {
  console.log("POST /api/review/assign-reviewer - START");
  console.log("Request body:", JSON.stringify(req.body));

  try {
    const { adminId, contentId, reviewerId, teamId } = req.body;

    if (!adminId || !contentId || !reviewerId || !teamId) {
      console.log("ERROR: Missing required fields");
      return res.status(400).json({ error: "adminId, contentId, reviewerId, and teamId are required" });
    }

    console.log("Verifying admin status for user:", adminId);
    const adminRef = db.collection("Users").doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      console.log("ERROR: Admin user not found");
      return res.status(404).json({ error: "Admin user not found" });
    }

    const adminData = adminDoc.data();
    if (adminData.role !== "admin") {
      console.log("ERROR: User is not an admin, role:", adminData.role);
      return res.status(403).json({ error: "Only admins can assign reviewers" });
    }
    if (adminData.teamId !== teamId) {
      console.log("ERROR: Admin does not have access to this team");
      return res.status(403).json({ error: "Admin does not have access to this team" });
    }

    console.log("Verifying reviewer:", reviewerId);
    const reviewerRef = db.collection("Users").doc(reviewerId);
    const reviewerDoc = await reviewerRef.get();

    if (!reviewerDoc.exists) {
      console.log("ERROR: Reviewer not found");
      return res.status(404).json({ error: "Reviewer not found" });
    }

    const reviewerData = reviewerDoc.data();
    if (reviewerData.teamId !== teamId) {
      console.log("ERROR: Reviewer does not belong to this team");
      return res.status(403).json({ error: "Reviewer does not belong to this team" });
    }

    if (reviewerData.role !== "reviewer") {
      console.log("ERROR: User is not a reviewer, role:", reviewerData.role);
      return res.status(403).json({ error: "Only users with reviewer role can be assigned as reviewers" });
    }

    console.log("Verifying content:", contentId);
    const contentRef = db.collection("content").doc(contentId);
    const contentDoc = await contentRef.get();

    if (!contentDoc.exists) {
      console.log("ERROR: Content not found");
      return res.status(404).json({ error: "Content not found" });
    }

    const contentData = contentDoc.data() || {};

    // Seed reviewStatusCode = ASSIGNED so downstream filters have a clear status
    // from the moment of assignment. Do NOT overwrite existing reviewStatus (lowercase)
    // to preserve backward compatibility with legacy readers.
    console.log("Assigning reviewer to content");
    await db.collection("content").doc(contentId).update({
      reviewerId: reviewerId,
      assignedAt: new Date().toISOString(),
      assignedBy: adminId,
      reviewStatusCode: REVIEW_STATUS.ASSIGNED,
    });

    if (reviewerId) {
      const adminName = buildDisplayName(adminData);
      const contentTitle = contentData.title || "Untitled";

      await createNotification({
        recipientId: reviewerId,
        type: "reviewer_assigned",
        title: "New Review Assignment",
        message: `${adminName} assigned you to review \"${contentTitle}\".`,
        contentId,
        actorId: adminId,
        eventKey: `reviewer_assigned_${contentId}_${reviewerId}`,
        metadata: {
          contentTitle,
          assignedBy: adminId,
          teamId,
        },
      });
    }

    console.log("SUCCESS: Reviewer assigned to content");
    res.json({
      success: true,
      message: "Reviewer assigned successfully",
      contentId: contentId,
      reviewerId: reviewerId,
      reviewerName: reviewerData.displayName || reviewerData.email,
    });
  } catch (error) {
    console.error("ERROR in assignReviewerToContent:", error);
    res.status(500).json({ error: error.message || "Failed to assign reviewer" });
  }
};

/**
 * submitReviewDecision - Server-side review approve/reject handler
 * Updates content stage and sends notification to the author.
 */
exports.submitReviewDecision = async (req, res) => {
  console.log("POST /api/team/review-decision - START");

  try {
    const { reviewerId, contentId, decision, rejectionReason } = req.body;

    if (!reviewerId || !contentId || !decision) {
      return res.status(400).json({ error: "reviewerId, contentId, and decision are required" });
    }

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    if (decision === "rejected" && !String(rejectionReason || "").trim()) {
      return res.status(400).json({ error: "rejectionReason is required when decision is rejected" });
    }

    const reviewerDoc = await db.collection("Users").doc(reviewerId).get();
    if (!reviewerDoc.exists) {
      return res.status(404).json({ error: "Reviewer not found" });
    }

    const reviewerData = reviewerDoc.data() || {};
    if (reviewerData.role !== "reviewer") {
      return res.status(403).json({ error: "Only reviewers can submit review decisions" });
    }

    const contentRef = db.collection("content").doc(contentId);
    const contentDoc = await contentRef.get();

    if (!contentDoc.exists) {
      return res.status(404).json({ error: "Content not found" });
    }

    const contentData = contentDoc.data() || {};
    if (contentData.reviewerId !== reviewerId) {
      return res.status(403).json({ error: "You are not assigned to review this content" });
    }

    const nowIso = new Date().toISOString();

    const updatePayload = {
      reviewedAt: nowIso,
      reviewedBy: reviewerId,
      reviewStatus: decision, // legacy lowercase field, preserved
    };

    // Aminah updated: build a snapshot of the content before the review decision is applied so it can be stored in versionHistory for the author to view later.
    const previousSnapshot = {
      title: contentData.title || "",
      text: contentData.text || "",
      stage: contentData.stage || "Draft",
      snapshotAt: nowIso,
      snapshotBy: reviewerId,
      changeType: decision === "approved" ? "review_approved" : "review_rejected",
      reason: decision === "rejected"
        ? String(rejectionReason || "").trim()
        : "Approved by reviewer",
    };

    if (decision === "approved") {
      updatePayload.stage = "Ready To Post";
      updatePayload.reviewStatusCode = REVIEW_STATUS.APPROVED;
      updatePayload.approvedAt = nowIso;
      // Clear any stale rejection artefacts from a prior rejection cycle
      updatePayload.rejectionReason = admin.firestore.FieldValue.delete();
      updatePayload.rejectedAt = admin.firestore.FieldValue.delete();
    } else {
      updatePayload.stage = "Update";
      updatePayload.reviewStatusCode = REVIEW_STATUS.REJECTED;
      updatePayload.rejectionReason = String(rejectionReason || "").trim();
      updatePayload.rejectedAt = nowIso;
      // Clear any stale approval artefact from a prior approval cycle
      updatePayload.approvedAt = admin.firestore.FieldValue.delete();
    }
    updatePayload.wasResubmitted = admin.firestore.FieldValue.delete();
    updatePayload.resubmittedAt = admin.firestore.FieldValue.delete();
    updatePayload.previousRejectionReason = admin.firestore.FieldValue.delete();
    updatePayload.previousRejectedAt = admin.firestore.FieldValue.delete();

    // Aminah updated: atomically append the snapshot to the versionHistory array alongside the review decision update.
    await contentRef.update({
      ...updatePayload,
      versionHistory: admin.firestore.FieldValue.arrayUnion(previousSnapshot),
    });

    const creatorId = contentData.createdBy;
    if (creatorId) {
      const reviewerName = buildDisplayName(reviewerData);
      const contentTitle = contentData.title || "Untitled";

      if (decision === "approved") {
        await createNotification({
          recipientId: creatorId,
          type: "review_approved",
          title: "Content Approved",
          message: `${reviewerName} approved \"${contentTitle}\". It's now ready to post.`,
          contentId,
          actorId: reviewerId,
          eventKey: `review_approved_${contentId}_${reviewerId}_${updatePayload.reviewedAt}`,
          dedupe: false,
          metadata: {
            contentTitle,
            reviewStatus: decision,
            reviewStatusCode: REVIEW_STATUS.APPROVED,
            reviewedAt: updatePayload.reviewedAt,
            actionRoute: "/dashboard",
            actionLabel: "Go to content",
          },
        });
      } else {
        await createNotification({
          recipientId: creatorId,
          type: "review_rejected",
          title: "Changes Requested",
          message: `${reviewerName} requested updates for \"${contentTitle}\".`,
          contentId,
          actorId: reviewerId,
          eventKey: `review_rejected_${contentId}_${reviewerId}_${updatePayload.reviewedAt}`,
          dedupe: false,
          metadata: {
            contentTitle,
            reviewStatus: decision,
            reviewStatusCode: REVIEW_STATUS.REJECTED,
            rejectionReason: String(rejectionReason || "").trim(),
            reviewedAt: updatePayload.reviewedAt,
            actionRoute: "/dashboard",
            actionLabel: "Go to content",
          },
        });
      }
    }

    return res.json({ success: true, contentId, decision, ...updatePayload });
  } catch (error) {
    console.error("ERROR in submitReviewDecision:", error);
    return res.status(500).json({ error: error.message || "Failed to submit review decision" });
  }
};

/**
 * revertReviewDecision - Allows the assigned reviewer to undo an approval.
 */
exports.revertReviewDecision = async (req, res) => {
  console.log("POST /api/team/review-revert - START");

  try {
    const { reviewerId, contentId, target, rejectionReason } = req.body;

    if (!reviewerId || !contentId) {
      return res.status(400).json({ error: "reviewerId and contentId are required" });
    }

    const normalizedTarget = String(target || "assigned").toLowerCase();
    if (!["assigned", "rejected"].includes(normalizedTarget)) {
      return res.status(400).json({ error: "target must be 'assigned' or 'rejected'" });
    }

    if (normalizedTarget === "rejected" && !String(rejectionReason || "").trim()) {
      return res
        .status(400)
        .json({ error: "rejectionReason is required when reverting to rejected" });
    }

    const reviewerDoc = await db.collection("Users").doc(reviewerId).get();
    if (!reviewerDoc.exists) {
      return res.status(404).json({ error: "Reviewer not found" });
    }

    const reviewerData = reviewerDoc.data() || {};
    if (reviewerData.role !== "reviewer") {
      return res.status(403).json({ error: "Only reviewers can revert review decisions" });
    }

    const contentRef = db.collection("content").doc(contentId);
    const contentDoc = await contentRef.get();
    if (!contentDoc.exists) {
      return res.status(404).json({ error: "Content not found" });
    }

    const contentData = contentDoc.data() || {};
    if (contentData.reviewerId !== reviewerId) {
      return res.status(403).json({ error: "You are not assigned to review this content" });
    }

    const currentStatusCode = String(contentData.reviewStatusCode || "").toUpperCase();
    const legacyStatus = String(contentData.reviewStatus || "").toLowerCase();
    const isCurrentlyApproved =
      currentStatusCode === REVIEW_STATUS.APPROVED || legacyStatus === "approved";

    if (!isCurrentlyApproved) {
      return res
        .status(409)
        .json({ error: "Only approved content can be reverted." });
    }

    const nowIso = new Date().toISOString();

    const previousSnapshot = {
      title: contentData.title || "",
      text: contentData.text || "",
      stage: contentData.stage || "Ready To Post",
      snapshotAt: nowIso,
      snapshotBy: reviewerId,
      changeType: "review_reverted",
      reason:
        normalizedTarget === "rejected"
          ? `Approval reverted — changes requested: ${String(rejectionReason).trim()}`
          : "Approval reverted — moved back to review queue",
    };

    const updatePayload = {
      reviewedAt: nowIso,
      reviewedBy: reviewerId,
      approvedAt: admin.firestore.FieldValue.delete(),
    };

    if (normalizedTarget === "rejected") {
      updatePayload.stage = "Update";
      updatePayload.reviewStatus = "rejected";
      updatePayload.reviewStatusCode = REVIEW_STATUS.REJECTED;
      updatePayload.rejectionReason = String(rejectionReason).trim();
      updatePayload.rejectedAt = nowIso;
    } else {
      updatePayload.stage = "Review";
      updatePayload.reviewStatus = admin.firestore.FieldValue.delete();
      updatePayload.reviewStatusCode = REVIEW_STATUS.ASSIGNED;
      updatePayload.rejectionReason = admin.firestore.FieldValue.delete();
      updatePayload.rejectedAt = admin.firestore.FieldValue.delete();
    }

    // Clear any lingering "resubmitted after rejection" markers on revert —
    // the reviewer has now acted fresh, so the context from a prior resubmission
    // no longer applies.
    updatePayload.wasResubmitted = admin.firestore.FieldValue.delete();
    updatePayload.resubmittedAt = admin.firestore.FieldValue.delete();
    updatePayload.previousRejectionReason = admin.firestore.FieldValue.delete();
    updatePayload.previousRejectedAt = admin.firestore.FieldValue.delete();

    await contentRef.update({
      ...updatePayload,
      versionHistory: admin.firestore.FieldValue.arrayUnion(previousSnapshot),
    });

    const creatorId = contentData.createdBy;
    if (creatorId) {
      const reviewerName = buildDisplayName(reviewerData);
      const contentTitle = contentData.title || "Untitled";

      await createNotification({
        recipientId: creatorId,
        type: "review_reverted",
        title: "Approval Reverted",
        message:
          normalizedTarget === "rejected"
            ? `${reviewerName} reverted the approval on \"${contentTitle}\" and requested changes.`
            : `${reviewerName} reverted the approval on \"${contentTitle}\" — it's back in review.`,
        contentId,
        actorId: reviewerId,
        eventKey: `review_reverted_${contentId}_${reviewerId}_${nowIso}`,
        dedupe: false,
        metadata: {
          contentTitle,
          reviewStatusCode: updatePayload.reviewStatusCode,
          revertedTo: normalizedTarget,
          rejectionReason:
            normalizedTarget === "rejected" ? String(rejectionReason).trim() : null,
          revertedAt: nowIso,
          actionRoute: "/dashboard",
          actionLabel: "Go to content",
        },
      });
    }

    return res.json({
      success: true,
      contentId,
      target: normalizedTarget,
      ...updatePayload,
    });
  } catch (error) {
    console.error("ERROR in revertReviewDecision:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to revert review decision" });
  }
};

/**
 * submitAuthorContentUpdate - Server-side author update handler
 * Updates content and notifies reviewer when previously rejected content is updated.
 */
exports.submitAuthorContentUpdate = async (req, res) => {
  console.log("POST /api/team/content-update - START");

  try {
    const { authorId, contentId, title, text, stage } = req.body;

    if (!authorId || !contentId) {
      return res.status(400).json({ error: "authorId and contentId are required" });
    }

    const contentRef = db.collection("content").doc(contentId);
    const contentDoc = await contentRef.get();
    if (!contentDoc.exists) {
      return res.status(404).json({ error: "Content not found" });
    }

    const contentData = contentDoc.data() || {};
    if (contentData.createdBy !== authorId) {
      return res.status(403).json({ error: "You can only update your own content" });
    }

    const authorDoc = await db.collection("Users").doc(authorId).get();
    const authorData = authorDoc.exists ? authorDoc.data() || {} : {};
    const teamId = authorData.teamId || contentData.teamId || null;

    const updatePayload = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof title === "string") updatePayload.title = title;
    if (typeof text === "string") updatePayload.text = text;
    if (typeof stage === "string" && stage.trim()) updatePayload.stage = stage;

    const nextTitle = typeof title === "string" ? title : contentData.title || "";
    const nextText = typeof text === "string" ? text : contentData.text || "";
    const nextStage = typeof stage === "string" && stage.trim() ? stage : contentData.stage || "Draft";

    const hasChanged =
      nextTitle !== (contentData.title || "") ||
      nextText !== (contentData.text || "") ||
      nextStage !== (contentData.stage || "Draft");

    // Aminah updated: only snapshot the previous content into versionHistory when something actually changed, to avoid storing meaningless no-op entries.
    if (hasChanged) {
      updatePayload.versionHistory = admin.firestore.FieldValue.arrayUnion({
        title: contentData.title || "",
        text: contentData.text || "",
        stage: contentData.stage || "Draft",
        snapshotAt: new Date().toISOString(),
        snapshotBy: authorId,
        changeType: "manual_edit",
        reason: "Edited from dashboard",
      });
    }

    let assignedReviewer = null;
    const nextStageNormalized = normalizeStageValue(nextStage);
    if (nextStageNormalized === "review" && !contentData.reviewerId) {
      assignedReviewer = await findAutoReviewerForTeam(teamId, authorId);
      if (assignedReviewer) {
        updatePayload.reviewerId = assignedReviewer.id;
        updatePayload.assignedAt = new Date().toISOString();
        updatePayload.assignedBy = authorId;
        // Seed a clean ASSIGNED status for a fresh assignment
        updatePayload.reviewStatusCode = REVIEW_STATUS.ASSIGNED;
        updatePayload.reviewStatus = admin.firestore.FieldValue.delete();
      }
    }

    // When an author re-submits previously-rejected content for another review pass, we want to preserve the context of the prior rejection for the reviewer to reference during their next review. This includes retaining the original rejection reason and timestamp in dedicated "previous" fields, and marking the item as resubmitted with a timestamp so the reviewer can easily filter for or identify resubmissions in the queue.
    const wasRejectedBefore =
      String(contentData.reviewStatus || "").toLowerCase() === "rejected" ||
      String(contentData.reviewStatusCode || "").toUpperCase() === REVIEW_STATUS.REJECTED ||
      String(contentData.stage || "").toLowerCase() === "update" ||
      Boolean(contentData.rejectionReason);

    const isResubmission = wasRejectedBefore && nextStageNormalized === "review";

    if (isResubmission) {
      updatePayload.reviewStatusCode = REVIEW_STATUS.ASSIGNED;
      updatePayload.reviewStatus = admin.firestore.FieldValue.delete();

      // Preserve the rejection context for the reviewer to see. Only write
      // previousRejectionReason if there actually was one — otherwise just mark
      // the item as resubmitted without fabricating a reason.
      const priorReason = String(contentData.rejectionReason || "").trim();
      if (priorReason) {
        updatePayload.previousRejectionReason = priorReason;
      }
      if (contentData.rejectedAt) {
        updatePayload.previousRejectedAt = contentData.rejectedAt;
      }

      updatePayload.wasResubmitted = true;
      updatePayload.resubmittedAt = new Date().toISOString();

      // Clear the "current" rejection fields so the item no longer reads as rejected.
      updatePayload.rejectionReason = admin.firestore.FieldValue.delete();
      updatePayload.rejectedAt = admin.firestore.FieldValue.delete();
    }

    await contentRef.update(updatePayload);

    if (assignedReviewer) {
      const authorName = buildDisplayName(authorData);
      const contentTitle = nextTitle.trim() || contentData.title || "Untitled";

      await createNotification({
        recipientId: assignedReviewer.id,
        type: "reviewer_assigned",
        title: "New Review Assignment",
        message: `${authorName} assigned you to review \"${contentTitle}\".`,
        contentId,
        actorId: authorId,
        eventKey: `reviewer_assigned_${contentId}_${assignedReviewer.id}_${Date.now()}`,
        dedupe: false,
        metadata: {
          contentTitle,
          assignedBy: authorId,
          teamId,
          actionRoute: "/review",
          actionLabel: "Go to review",
        },
      });
    }

    const wasRejected =
      String(contentData.reviewStatus || "").toLowerCase() === "rejected" ||
      String(contentData.stage || "").toLowerCase() === "update" ||
      Boolean(contentData.rejectionReason);

    const reviewerId = updatePayload.reviewerId || contentData.reviewerId;
    if (wasRejected && reviewerId) {
      const authorName = buildDisplayName(authorData);
      const contentTitle = (typeof title === "string" && title.trim())
        ? title.trim()
        : contentData.title || "Untitled";
      const isResubmissionNotification = isResubmission;

      await createNotification({
        recipientId: reviewerId,
        type: isResubmissionNotification ? "content_resubmitted" : "content_updated",
        title: isResubmissionNotification ? "Resubmitted for Review" : "Content Updated",
        message: isResubmissionNotification
          ? `${authorName} updated \"${contentTitle}\" and resubmitted it for review.`
          : `${authorName} updated \"${contentTitle}\" after your feedback.`,
        contentId,
        actorId: authorId,
        eventKey: isResubmissionNotification
          ? `content_resubmitted_${contentId}_${Date.now()}`
          : `content_updated_${contentId}_${Date.now()}`,
        metadata: {
          contentTitle,
          previousStage: contentData.stage || null,
          newStage: updatePayload.stage || contentData.stage || null,
          ...(isResubmissionNotification ? { wasResubmitted: true } : {}),
          actionRoute: "/review",
          actionLabel: "Go to review",
        },
      });
    }

    return res.json({
      success: true,
      contentId,
      assignedReviewerId: updatePayload.reviewerId || contentData.reviewerId || null,
      ...updatePayload,
    });
  } catch (error) {
    console.error("ERROR in submitAuthorContentUpdate:", error);
    return res.status(500).json({ error: error.message || "Failed to update content" });
  }
};

exports.removeMemberFromTeam = async (req, res) => {
  console.log("POST /api/team/remove-member - START");

  try {
    const { adminId, memberId, teamId } = req.body;

    if (!adminId || !memberId || !teamId) {
      return res.status(400).json({ error: "adminId, memberId, and teamId are required" });
    }

    if (adminId === memberId) {
      return res.status(400).json({ error: "Admins cannot remove themselves from the team" });
    }

    const adminDoc = await db.collection("Users").doc(adminId).get();
    if (!adminDoc.exists) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    const adminData = adminDoc.data();
    if (adminData.role !== "admin") {
      return res.status(403).json({ error: "Only admins can remove team members" });
    }

    if (adminData.teamId !== teamId) {
      return res.status(403).json({ error: "Admin does not have access to this team" });
    }

    const memberDoc = await db.collection("Users").doc(memberId).get();
    if (!memberDoc.exists) {
      return res.status(404).json({ error: "Member not found" });
    }

    const memberData = memberDoc.data();
    if (memberData.teamId !== teamId) {
      return res.status(403).json({ error: "Member does not belong to this team" });
    }

    await db.collection("Users").doc(memberId).update({
      teamId: admin.firestore.FieldValue.delete(),
      role: "user",
    });

    console.log("SUCCESS: Member removed from team");
    res.json({ success: true, message: "Member removed from team successfully" });
  } catch (error) {
    console.error("ERROR in removeMemberFromTeam:", error);
    res.status(500).json({ error: error.message || "Failed to remove member" });
  }
};

exports.REVIEW_STATUS = REVIEW_STATUS;