const express = require("express");
const requireFirebaseAuth = require("../middleware/requireFirebaseAuth");
const {
  startOAuth,
  oauthCallback,
  driveStatus,
  listDrives,
  listFiles,
  importDriveFileToContent,
  uploadContentToDrive,
  disconnectDrive,
  previewDriveFile,
} = require("../controllers/driveController");

const router = express.Router();

// OAuth start requires an authenticated app user; callback comes from Google.
router.get("/oauth/start", requireFirebaseAuth, startOAuth);
router.get("/oauth/callback", oauthCallback);

router.get("/status", requireFirebaseAuth, driveStatus);
router.get("/drives", requireFirebaseAuth, listDrives);
router.get("/files", requireFirebaseAuth, listFiles);
router.get("/preview", requireFirebaseAuth, previewDriveFile);

router.post("/import-content", requireFirebaseAuth, importDriveFileToContent);
router.post("/upload-content", requireFirebaseAuth, uploadContentToDrive);
router.post("/disconnect", requireFirebaseAuth, disconnectDrive);

module.exports = router;
