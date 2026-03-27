const express = require("express");
const router = express.Router();

const requireFirebaseAuth = require("../middleware/requireFirebaseAuth");
const driveController = require("../controllers/driveController");

router.get("/oauth/start", requireFirebaseAuth, driveController.startOAuth);
router.get("/oauth/callback", driveController.oauthCallback);
router.get("/status", requireFirebaseAuth, driveController.driveStatus);
router.get("/files", requireFirebaseAuth, driveController.listFiles);
router.post("/import-content", requireFirebaseAuth, driveController.importDriveFileToContent);
router.post("/upload-content", requireFirebaseAuth, driveController.uploadContentToDrive);
router.post("/disconnect", requireFirebaseAuth, driveController.disconnectDrive);

module.exports = router;