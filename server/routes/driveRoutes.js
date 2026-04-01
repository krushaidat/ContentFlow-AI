const express = require("express");
const router = express.Router();

const requireFirebaseAuth = require("../middleware/requireFirebaseAuth");
const driveController = require("../controllers/driveController");

// Begin the Google OAuth 2.0 consent flow — returns a redirect URL to the client
router.get("/oauth/start",     requireFirebaseAuth, driveController.startOAuth);

// Google redirects back here after the user grants/denies Drive access
router.get("/oauth/callback",  driveController.oauthCallback);

// Returns whether the current user has an active Drive connection
router.get("/status",          requireFirebaseAuth, driveController.driveStatus);

// Returns the user's list of drives (My Drive + Shared Drives) for the browser tabs
router.get("/drives",          requireFirebaseAuth, driveController.listDrives);

// Lists files and folders inside a given drive/folder (supports folderId, driveId, pagination)
router.get("/files",           requireFirebaseAuth, driveController.listFiles);

router.get("/preview",   requireFirebaseAuth, driveController.previewDriveFile);

// Imports a Drive file into a new Firestore content document
router.post("/import-content", requireFirebaseAuth, driveController.importDriveFileToContent);

// Uploads a Firestore content document to the user's Drive as a .txt file
router.post("/upload-content", requireFirebaseAuth, driveController.uploadContentToDrive);

// Clears the stored Drive refresh token, disconnecting the integration
router.post("/disconnect",     requireFirebaseAuth, driveController.disconnectDrive);

module.exports = router;