const db = require("../config/firebase");
const admin = require("firebase-admin");

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

    // Assign reviewer to content
    console.log("Assigning reviewer to content");
    await db.collection("content").doc(contentId).update({
      reviewerId: reviewerId,
      assignedAt: new Date().toISOString(),
      assignedBy: adminId,
    });

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
