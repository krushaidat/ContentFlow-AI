const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function getCredential() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_KEY_PATH } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  const keyPath = FIREBASE_KEY_PATH || path.join(__dirname, "..", "firebase-key.json");
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Firebase key not found at: ${keyPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  return admin.credential.cert(serviceAccount);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: getCredential(),
  });
}

const db = admin.firestore();

// Support both:
// const db = require("../config/firebase")
// and
// const { db } = require("../config/firebase")
module.exports = db;
module.exports.db = db;
module.exports.admin = admin;