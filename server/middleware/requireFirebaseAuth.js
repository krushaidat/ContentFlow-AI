const { admin } = require("../config/firebase");

async function requireFirebaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const idToken = authHeader.slice("Bearer ".length).trim();
    const decoded = await admin.auth().verifyIdToken(idToken);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
    };

    return next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = requireFirebaseAuth;