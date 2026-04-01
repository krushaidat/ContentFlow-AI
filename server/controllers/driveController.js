const crypto = require("crypto");
const { google } = require("googleapis");
const { db } = require("../config/firebase");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error("Missing env var: " + name);
  }
  return value;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    getRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI")
  );
}

function signState(payloadObj) {
  const secret = getRequiredEnv("GOOGLE_OAUTH_STATE_SECRET");
  const payloadJson = JSON.stringify(payloadObj);
  const payloadB64 = Buffer.from(payloadJson).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return payloadB64 + "." + sig;
}

function verifyState(token) {
  const secret = getRequiredEnv("GOOGLE_OAUTH_STATE_SECRET");
  const parts = (token || "").split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid state format");
  }

  const payloadB64 = parts[0];
  const sig = parts[1];
  const expected = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid state signature");
  }

  const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
  const payload = JSON.parse(payloadJson);

  if (!payload.uid || !payload.exp || Date.now() > payload.exp) {
    throw new Error("Expired or invalid state payload");
  }

  return payload;
}

function getAesKey() {
  const keyHex = getRequiredEnv("DRIVE_TOKEN_ENCRYPTION_KEY");
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("DRIVE_TOKEN_ENCRYPTION_KEY must be 32 bytes hex");
  }
  return key;
}

function encryptText(plainText) {
  const key = getAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64")
  };
}

function decryptText(encObj) {
  const key = getAesKey();
  const iv = Buffer.from(encObj.iv, "base64");
  const tag = Buffer.from(encObj.tag, "base64");
  const data = Buffer.from(encObj.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

async function getDriveForUser(uid) {
  const userRef = db.collection("Users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error("User document not found");
  }

  const userData = userSnap.data() || {};
  const drive = (((userData.integrations || {}).googleDrive) || {});
  const encryptedRefreshToken = drive.refreshTokenEncrypted;

  if (!encryptedRefreshToken) {
    const err = new Error("Google Drive not connected");
    err.code = "DRIVE_NOT_CONNECTED";
    throw err;
  }

  const refreshToken = decryptText(encryptedRefreshToken);
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const driveApi = google.drive({ version: "v3", auth: oauth2Client });
  return { driveApi, oauth2Client, userRef };
}

/**
 * startOAuth — begins the Google OAuth 2.0 authorization flow.
 * Generates a time-limited, HMAC-signed state token to prevent CSRF,
 * then returns the Google consent-screen URL to the client so it can
 * redirect the user's browser there.
 */
exports.startOAuth = async (req, res) => {
  try {
    const uid = req.user.uid;
    const oauth2Client = getOAuthClient();

    const statePayload = {
      uid: uid,
      exp: Date.now() + 10 * 60 * 1000
    };

    const state = signState(statePayload);

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: [
        // drive.readonly — required to browse existing files, folders, and Shared Drives
        "https://www.googleapis.com/auth/drive.readonly",
        // drive.file — required to upload/create new files on behalf of the user
        "https://www.googleapis.com/auth/drive.file"
      ],
      state: state
    });

    return res.json({ authUrl: url });
  } catch (error) {
    console.error("startOAuth error:", error.message);
    return res.status(500).json({
      error: "Failed to start OAuth flow",
      ...(process.env.NODE_ENV === "production" ? {} : { detail: error.message })
    });
  }
};

/**
 * oauthCallback — handles the redirect back from Google after the user
 * grants (or denies) consent. Verifies the state token, exchanges the
 * authorization code for tokens, and stores the encrypted refresh token
 * in the user's Firestore document so future requests can access Drive
 * without re-prompting the user.
 */
exports.oauthCallback = async (req, res) => {
  const successRedirect = process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT || "http://localhost:5173/dashboard?drive=connected";
  const errorRedirect = process.env.GOOGLE_OAUTH_ERROR_REDIRECT || "http://localhost:5173/dashboard?drive=error";

  try {
    const code = req.query.code;
    const state = req.query.state;

    if (!code || !state) {
      return res.redirect(errorRedirect);
    }

    const statePayload = verifyState(state);
    const uid = statePayload.uid;

    const oauth2Client = getOAuthClient();
    const tokenResp = await oauth2Client.getToken(code);
    const tokens = tokenResp.tokens || {};

    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const userRef = db.collection("Users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.redirect(errorRedirect);
      }
      const existing = ((((userSnap.data() || {}).integrations || {}).googleDrive || {}).refreshTokenEncrypted);
      if (!existing) {
        return res.redirect(errorRedirect);
      }
    }

    const userRef = db.collection("Users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.redirect(errorRedirect);
    }

    const prev = userSnap.data() || {};
    const prevRefresh = ((((prev.integrations || {}).googleDrive || {}).refreshTokenEncrypted) || null);

    const refreshToStore = refreshToken ? encryptText(refreshToken) : prevRefresh;

    await userRef.set({
      integrations: {
        googleDrive: {
          connected: true,
          scope: tokens.scope || null,
          refreshTokenEncrypted: refreshToStore,
          updatedAt: new Date().toISOString()
        }
      }
    }, { merge: true });

    return res.redirect(successRedirect);
  } catch (error) {
    console.error("oauthCallback error:", error.message);
    return res.redirect(errorRedirect);
  }
};

/**
 * driveStatus — returns whether the current user has a connected Google
 * Drive integration. Used by the Dashboard to show/hide the Drive buttons
 * and to surface the last connection timestamp.
 */
exports.driveStatus = async (req, res) => {
  try {
    const uid = req.user.uid;
    const userSnap = await db.collection("Users").doc(uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const drive = (((userSnap.data() || {}).integrations || {}).googleDrive || {});
    return res.json({
      connected: !!drive.connected,
      updatedAt: drive.updatedAt || null
    });
  } catch (error) {
    console.error("driveStatus error:", error.message);
    return res.status(500).json({ error: "Failed to read Drive status" });
  }
};

/**
 * listDrives — returns all drives accessible to the user.
 * Always prepends a virtual "My Drive" entry (the personal drive has no
 * entry in the drives.list response), followed by any Shared Drives.
 * Used by DriveBrowser to populate the drive-selector tabs.
 */
exports.listDrives = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { driveApi } = await getDriveForUser(uid);

    // My Drive is always available — it has no entry in drives.list so we add it manually
    const myDrive = { id: "root", name: "My Drive", kind: "personal" };

    // Shared Drives require the drive.readonly scope.
    // This call may return an empty list
    // or a 403 — we catch that gracefully and just return My Drive.
    let sharedDrives = [];
    try {
      const resp = await driveApi.drives.list({
        pageSize: 50,
        fields: "drives(id, name, kind)"
      });
      sharedDrives = resp.data.drives || [];
    } catch (drivesErr) {
      // Insufficient scope or no shared drives — non-fatal, continue with My Drive only
      console.warn("listDrives: could not fetch shared drives:", drivesErr.message);
    }

    return res.json({ drives: [myDrive, ...sharedDrives] });
  } catch (error) {
    if (error.code === "DRIVE_NOT_CONNECTED") {
      return res.status(400).json({ error: "Google Drive is not connected" });
    }
    console.error("listDrives error:", error.message);
    return res.status(500).json({ error: "Failed to list drives" });
  }
};

/**
 * listFiles — lists files and folders inside a specific folder or drive root.
 *
 * Query params:
 *   driveId   — the Drive to browse. "root" = My Drive, otherwise a Shared Drive ID.
 *   folderId  — the folder to list the contents of. Omit to list the drive root.
 *   pageToken — pagination cursor returned by a previous call.
 *   pageSize  — max items per page (default 50).
 *
 * Results are ordered folders-first then alphabetically so the UI always
 * shows navigable folders at the top of the list.
 */
exports.listFiles = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { driveApi } = await getDriveForUser(uid);

    const folderId  = req.query.folderId  || null;
    const driveId   = req.query.driveId   || null;
    const pageToken = req.query.pageToken || undefined;
    const pageSize  = Math.min(Number(req.query.pageSize || 50), 100);

    // Determine if we are browsing a Shared Drive
    const isSharedDrive = driveId && driveId !== "root";

    // If user is inside a folder, keep folder-scoped listing.
    // If no folder selected, show all visible files in that drive scope.
    const q = folderId
      ? `'${folderId}' in parents and trashed = false`
      : "trashed = false";

    const resp = await driveApi.files.list({
      q,
      pageToken,
      pageSize,
      // "drive" corpora is required when scoping to a specific Shared Drive
      corpora: isSharedDrive ? "drive" : "user",
      driveId: isSharedDrive ? driveId : undefined,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      // Show folders before files, then sort alphabetically within each group
      orderBy: "folder,name",
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, driveId)"
    });

    return res.json({
      files: resp.data.files || [],
      nextPageToken: resp.data.nextPageToken || null
    });
  } catch (error) {
    if (error.code === "DRIVE_NOT_CONNECTED") {
      return res.status(400).json({ error: "Google Drive is not connected" });
    }
    console.error("listFiles error:", error.message);
    return res.status(500).json({ error: "Failed to list files" });
  }
};

/**
 * importDriveFileToContent — fetches a file from the user's Drive and
 * creates a new content document in Firestore from its text.
 * Google Docs are exported as plain text via the export API.
 * All other files are downloaded directly and decoded as UTF-8.
 * The resulting content is set to "Draft" stage so the user can review
 * it before moving it through the workflow.
 */
exports.importDriveFileToContent = async (req, res) => {
  try {
    const uid = req.user.uid;
    const fileId = req.body.fileId;

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const { driveApi } = await getDriveForUser(uid);

    const metaResp = await driveApi.files.get({
      fileId: fileId,
      fields: "id, name, mimeType",
      supportsAllDrives: true
    });

    const meta = metaResp.data || {};
    let textContent = "";

    if (meta.mimeType === "application/vnd.google-apps.document") {
      const exportResp = await driveApi.files.export(
        { fileId: fileId, mimeType: "text/plain" },
        { responseType: "arraybuffer" }
      );
      textContent = Buffer.from(exportResp.data).toString("utf8");
    } else {
      const mediaResp = await driveApi.files.get(
        { fileId: fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      textContent = Buffer.from(mediaResp.data).toString("utf8");
    }

    const contentPayload = {
      title: meta.name || "Imported from Drive",
      text: textContent || "",
      stage: "Draft",
      createdBy: uid,
      createdAt: new Date().toISOString(),
      driveFileId: meta.id,
      driveImportedAt: new Date().toISOString()
    };

    const created = await db.collection("content").add(contentPayload);

    return res.json({
      success: true,
      contentId: created.id,
      title: contentPayload.title
    });
  } catch (error) {
    if (error.code === "DRIVE_NOT_CONNECTED") {
      return res.status(400).json({ error: "Google Drive is not connected" });
    }
    console.error("importDriveFileToContent error:", error.message);
    return res.status(500).json({ error: "Failed to import file from Drive" });
  }
};

/**
 * uploadContentToDrive — pushes a ContentFlow content item to the user's
 * Google Drive as a plain-text file. If the content was previously
 * uploaded (has a driveFileId), it updates the existing file in-place
 * instead of creating a duplicate. Optionally accepts a folderId in the
 * request body to place new files inside a specific folder.
 * The Drive file ID and shareable link are saved back to Firestore.
 */
exports.uploadContentToDrive = async (req, res) => {
  try {
    const uid = req.user.uid;
    const contentId = req.body.contentId;
    const folderId = req.body.folderId || null;

    if (!contentId) {
      return res.status(400).json({ error: "contentId is required" });
    }

    const contentRef = db.collection("content").doc(contentId);
    const contentSnap = await contentRef.get();

    if (!contentSnap.exists) {
      return res.status(404).json({ error: "Content not found" });
    }

    const contentData = contentSnap.data() || {};
    if (contentData.createdBy !== uid) {
      return res.status(403).json({ error: "You can only upload your own content" });
    }

    const title = contentData.title || "ContentFlow Export";
    const body = contentData.text || "";
    const fullText = "Title: " + title + "\n\n" + body;

    const { driveApi } = await getDriveForUser(uid);

    const media = {
      mimeType: "text/plain",
      body: fullText
    };

    let driveResult;
    if (contentData.driveFileId) {
      driveResult = await driveApi.files.update({
        fileId: contentData.driveFileId,
        media: media,
        fields: "id, webViewLink",
        supportsAllDrives: true
      });
    } else {
      const requestBody = {
        name: title + ".txt",
        mimeType: "text/plain"
      };
      if (folderId) {
        requestBody.parents = [folderId];
      }

      driveResult = await driveApi.files.create({
        requestBody: requestBody,
        media: media,
        fields: "id, webViewLink",
        supportsAllDrives: true
      });
    }

    const driveFileId = (driveResult.data || {}).id || null;
    const webViewLink = (driveResult.data || {}).webViewLink || null;

    await contentRef.set({
      driveFileId: driveFileId,
      driveWebViewLink: webViewLink,
      driveSyncedAt: new Date().toISOString()
    }, { merge: true });

    return res.json({
      success: true,
      driveFileId: driveFileId,
      webViewLink: webViewLink
    });
  } catch (error) {
    if (error.code === "DRIVE_NOT_CONNECTED") {
      return res.status(400).json({ error: "Google Drive is not connected" });
    }
    console.error("uploadContentToDrive error:", error.message);
    return res.status(500).json({ error: "Failed to upload content to Drive" });
  }
};

/**
 * disconnectDrive — revokes the user's Google Drive integration by
 * clearing the stored encrypted refresh token in Firestore and marking
 * the connection as inactive. The user will need to go through OAuth
 * again to reconnect.
 */
exports.disconnectDrive = async (req, res) => {
  try {
    const uid = req.user.uid;
    await db.collection("Users").doc(uid).set({
      integrations: {
        googleDrive: {
          connected: false,
          refreshTokenEncrypted: null,
          updatedAt: new Date().toISOString()
        }
      }
    }, { merge: true });

    return res.json({ success: true });
  } catch (error) {
    console.error("disconnectDrive error:", error.message);
    return res.status(500).json({ error: "Failed to disconnect Drive" });
  }
};

  /**
 * previewDriveFile — returns a truncated text preview of a Drive file
 * without creating a Firestore content document.
 *
 * Query params:
 *   fileId — the Drive file ID to preview
 */
exports.previewDriveFile = async (req, res) => {
  try {
    const uid = req.user.uid;
    const fileId = req.query.fileId;

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const { driveApi } = await getDriveForUser(uid);

    const metaResp = await driveApi.files.get({
      fileId,
      fields: "id, name, mimeType, modifiedTime, size",
      supportsAllDrives: true
    });

    const meta = metaResp.data || {};
    const PREVIEW_CHAR_LIMIT = 3000;
    let previewText = "";

    if (meta.mimeType === "application/vnd.google-apps.document") {
      const exportResp = await driveApi.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "arraybuffer" }
      );
      const full = Buffer.from(exportResp.data).toString("utf8");
      previewText = full.slice(0, PREVIEW_CHAR_LIMIT);
    } else if (meta.mimeType && meta.mimeType.startsWith("text/")) {
      const mediaResp = await driveApi.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      const full = Buffer.from(mediaResp.data).toString("utf8");
      previewText = full.slice(0, PREVIEW_CHAR_LIMIT);
    } else {
      previewText = null; // non-text file — preview not available
    }

    return res.json({
      id: meta.id,
      name: meta.name,
      mimeType: meta.mimeType,
      modifiedTime: meta.modifiedTime,
      size: meta.size || null,
      preview: previewText,
      truncated: previewText !== null && previewText.length === PREVIEW_CHAR_LIMIT
    });
  } catch (error) {
    if (error.code === "DRIVE_NOT_CONNECTED") {
      return res.status(400).json({ error: "Google Drive is not connected" });
    }
    console.error("previewDriveFile error:", error.message);
    return res.status(500).json({ error: "Failed to preview file" });
  }
};