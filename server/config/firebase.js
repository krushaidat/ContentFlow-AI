const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function getServiceAccountFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    // .env commonly stores this with escaped newlines
    private_key: privateKey.replace(/\\n/g, "\n"),
  };
}

function getServiceAccountFromFile() {
  const candidates = [
    process.env.FIREBASE_KEY_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "../firebase-key.json"),
  ].filter(Boolean);

  for (const keyPath of candidates) {
    if (fs.existsSync(keyPath)) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(keyPath);
    }
  }

  return null;
}

function resolveServiceAccount() {
  const fromEnv = getServiceAccountFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const fromFile = getServiceAccountFromFile();
  if (fromFile) {
    return fromFile;
  }

  throw new Error(
    "Firebase credentials not found. Set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or FIREBASE_KEY_PATH/GOOGLE_APPLICATION_CREDENTIALS."
  );
}

const serviceAccount = resolveServiceAccount();

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

// Keep backward compatibility:
// - require("./config/firebase") used as db in most files
// - { admin } destructuring used in auth middleware
module.exports = db;
module.exports.db = db;
module.exports.admin = admin;