const { db, admin } = require("../config/firebase");

function buildDisplayName(userData = {}) {
  const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(" ").trim();
  return userData.displayName || fullName || userData.email || "Someone";
}

async function createNotification({
  recipientId,
  type,
  title,
  message,
  contentId = null,
  actorId = null,
  eventKey = null,
  metadata = null,
}) {
  if (!recipientId || !title || !message) {
    throw new Error("recipientId, title, and message are required");
  }

  const notificationsRef = db.collection("Users").doc(recipientId).collection("notifications");

  if (eventKey) {
    const existingSnapshot = await notificationsRef.where("eventKey", "==", eventKey).limit(1).get();
    if (!existingSnapshot.empty) {
      return existingSnapshot.docs[0].id;
    }
  }

  const payload = {
    type: type || "general",
    title,
    message,
    contentId,
    actorId,
    eventKey,
    read: false,
    readAt: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (metadata && Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  const notificationRef = await notificationsRef.add(payload);
  return notificationRef.id;
}

async function notifyAdminsForTeam({
  teamId,
  type,
  title,
  message,
  contentId = null,
  actorId = null,
  eventKeyPrefix = null,
  metadata = null,
}) {
  if (!teamId) {
    return [];
  }

  const usersSnapshot = await db.collection("Users").where("teamId", "==", teamId).get();
  const adminDocs = usersSnapshot.docs.filter((userDoc) => userDoc.data().role === "admin");

  const results = [];
  for (const adminDoc of adminDocs) {
    const notificationId = await createNotification({
      recipientId: adminDoc.id,
      type,
      title,
      message,
      contentId,
      actorId,
      eventKey: eventKeyPrefix ? `${eventKeyPrefix}_${adminDoc.id}` : null,
      metadata,
    });
    results.push(notificationId);
  }

  return results;
}

module.exports = {
  buildDisplayName,
  createNotification,
  notifyAdminsForTeam,
};