const admin = require("firebase-admin");
const path = require("path");

// Load the service account key
const serviceAccount = require(path.join(__dirname, "../firebase-key.json"));

// Only initialize if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  console.log("Firebase Admin SDK initialized successfully");
} else {
  console.log("Firebase Admin SDK already initialized");
}

// Export the Firestore database instance
const db = admin.firestore();
module.exports = db;