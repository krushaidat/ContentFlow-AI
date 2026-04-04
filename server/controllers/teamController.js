const { db } = require("../config/firebase");
const admin = require("firebase-admin");
const { createNotification, buildDisplayName } = require("../utils/notificationService");

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

    // Validate inputs
    if (!adminId || !memberEmail || !teamId) {
      console.log("ERROR: Missing required fields");
      return res.status(400).json({ error: "adminId, memberEmail, and teamId are required" });
    }

    // Verify the requesting user is an admin
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

    // Verify admin owns this team
    if (adminData.teamId !== teamId) {
      console.log("ERROR: Admin does not have access to this team");
      return res.status(403).json({ error: "Admin does not have access to this team" });
    }

    // Find the user to add by email
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

    // Add member to team
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

    // Validate inputs
    if (!adminId || !memberId || !newRole || !teamId) {
      console.log("ERROR: Missing required fields");
      return res.status(400).json({ error: "adminId, memberId, newRole, and teamId are required" });
    }

    // Validate role
    const validRoles = ["user", "author", "reviewer", "admin"];
    if (!validRoles.includes(newRole)) {
      console.log("ERROR: Invalid role:", newRole);
      return res.status(400).json({ error: "Invalid role. Must be one of: user, author, reviewer, admin" });
    }

    // Verify the requesting user is an admin
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

    // Verify admin owns this team
    if (adminData.teamId !== teamId) {
      console.log("ERROR: Admin does not have access to this team");
      return res.status(403).json({ error: "Admin does not have access to this team" });
    }

    // Verify the member exists and belongs to the team
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

    // Update member role
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

    // Validate inputs
    if (!adminId || !contentId || !reviewerId || !teamId) {
      console.log("ERROR: Missing required fields");
      return res.status(400).json({ error: "adminId, contentId, reviewerId, and teamId are required" });
    }

    // Verify the requesting user is an admin
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

    // Verify admin owns this team
    if (adminData.teamId !== teamId) {
      console.log("ERROR: Admin does not have access to this team");
      return res.status(403).json({ error: "Admin does not have access to this team" });
    }

    // Verify the reviewer exists and belongs to the team
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

    // Verify the content exists
    console.log("Verifying content:", contentId);
    const contentRef = db.collection("content").doc(contentId);
    const contentDoc = await contentRef.get();

    if (!contentDoc.exists) {
      console.log("ERROR: Content not found");
      return res.status(404).json({ error: "Content not found" });
    }

    const contentData = contentDoc.data() || {};

    // Assign reviewer to content
    console.log("Assigning reviewer to content");
    await db.collection("content").doc(contentId).update({
      reviewerId: reviewerId,
      assignedAt: new Date().toISOString(),
      assignedBy: adminId,
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

    const updatePayload = {
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerId,
      reviewStatus: decision,
    };

    // Aminah updated: build a snapshot of the content before the review decision is applied so it can be stored in versionHistory for the author to view later.
    const previousSnapshot = {
      title: contentData.title || "",
      text: contentData.text || "",
      stage: contentData.stage || "Draft",
      snapshotAt: new Date().toISOString(),
      snapshotBy: reviewerId,
      changeType: decision === "approved" ? "review_approved" : "review_rejected",
      reason: decision === "rejected"
        ? String(rejectionReason || "").trim()
        : "Approved by reviewer",
    };

    if (decision === "approved") {
      updatePayload.stage = "Ready-To-Post";
      updatePayload.rejectionReason = admin.firestore.FieldValue.delete();
    } else {
      updatePayload.stage = "Update";
      updatePayload.rejectionReason = String(rejectionReason || "").trim();
    }

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
          type: "ready_to_post",
          title: "Content Approved",
          message: `${reviewerName} approved \"${contentTitle}\". It's now ready to post.`,
          contentId,
          actorId: reviewerId,
          eventKey: `ready_to_post_${contentId}_${reviewerId}`,
          metadata: {
            contentTitle,
            reviewStatus: decision,
          },
        });
      } else {
        await createNotification({
          recipientId: creatorId,
          type: "content_rejected",
          title: "Changes Requested",
          message: `${reviewerName} requested updates for \"${contentTitle}\".`,
          contentId,
          actorId: reviewerId,
          eventKey: `content_rejected_${contentId}_${reviewerId}`,
          metadata: {
            contentTitle,
            reviewStatus: decision,
            rejectionReason: String(rejectionReason || "").trim(),
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

    await contentRef.update(updatePayload);

    const wasRejected =
      String(contentData.reviewStatus || "").toLowerCase() === "rejected" ||
      String(contentData.stage || "").toLowerCase() === "update" ||
      Boolean(contentData.rejectionReason);

    const reviewerId = contentData.reviewerId;
    if (wasRejected && reviewerId) {
      const authorDoc = await db.collection("Users").doc(authorId).get();
      const authorData = authorDoc.exists ? authorDoc.data() || {} : {};
      const authorName = buildDisplayName(authorData);
      const contentTitle = (typeof title === "string" && title.trim())
        ? title.trim()
        : contentData.title || "Untitled";

      await createNotification({
        recipientId: reviewerId,
        type: "content_updated",
        title: "Content Updated",
        message: `${authorName} updated \"${contentTitle}\" after your feedback.`,
        contentId,
        actorId: authorId,
        eventKey: `content_updated_${contentId}_${Date.now()}`,
        metadata: {
          contentTitle,
          previousStage: contentData.stage || null,
          newStage: updatePayload.stage || contentData.stage || null,
        },
      });
    }

    return res.json({ success: true, contentId, ...updatePayload });
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
