import { useState, useEffect, useCallback } from "react";
import "./styles/driveBrowser.css";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

/**
 * Mime types we support importing as text content.
 * Folders are always visible so users can keep navigating.
 */
const IMPORTABLE_TYPES = new Set([
  GOOGLE_DOC_MIME,
  "text/plain",
  "text/html",
  "text/markdown",
  "text/csv",
]);

function isImportable(mimeType) {
  if (!mimeType) return false;
  if (IMPORTABLE_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith("text/")) return true;
  return false;
}

function isVisibleInBrowser(item) {
  return item.mimeType === FOLDER_MIME || isImportable(item.mimeType);
}

function FileIcon({ mimeType }) {
  if (mimeType === FOLDER_MIME)
    return <span className="db-icon">📁</span>;
  if (mimeType === GOOGLE_DOC_MIME)
    return <span className="db-icon">📄</span>;
  if (mimeType === "application/vnd.google-apps.spreadsheet")
    return <span className="db-icon">📊</span>;
  if (mimeType === "application/vnd.google-apps.presentation")
    return <span className="db-icon">📽</span>;
  if (mimeType?.startsWith("image/"))
    return <span className="db-icon">🖼</span>;
  return <span className="db-icon">📎</span>;
}

function formatMimeType(mimeType) {
  if (!mimeType) return "";
  if (mimeType === FOLDER_MIME) return "Folder";
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    const type = mimeType.replace("application/vnd.google-apps.", "");
    return "Google " + type.charAt(0).toUpperCase() + type.slice(1);
  }
  return mimeType;
}

function formatBytes(bytes) {
  if (!bytes) return null;
  const n = Number(bytes);
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * PreviewPanel — right-hand panel that shows file metadata and a text
 * preview snippet. Displays a loading state while the preview is being
 * fetched, a "not available" state for binary/unsupported files, and a
 * truncation notice when the server only returned the first 3,000 chars.
 *
 * Props:
 *   file         {object|null}  — the currently selected Drive file object
 *   preview      {object|null}  — preview API response { preview, truncated, ... }
 *   previewLoading {boolean}    — true while the preview fetch is in flight
 *   previewError   {string|null}
 *   onImport     {() => void}   — called when the user clicks "Import"
 *   importing    {boolean}      — true while the import is in flight
 */
function PreviewPanel({ file, preview, previewLoading, previewError, onImport, importing }) {
  if (!file) {
    return (
      <div className="db-preview-panel db-preview-empty">
        <div className="db-preview-placeholder">
          <span className="db-preview-placeholder-icon">👈</span>
          <p>Select a file to preview it before importing</p>
        </div>
      </div>
    );
  }

  const meta = [
    formatMimeType(file.mimeType),
    file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : null,
    preview?.size ? formatBytes(preview.size) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="db-preview-panel">
      {/* Header */}
      <div className="db-preview-header">
        <FileIcon mimeType={file.mimeType} />
        <div className="db-preview-header-info">
          <span className="db-preview-filename">{file.name}</span>
          <span className="db-preview-meta">{meta}</span>
        </div>
      </div>

      {/* Body */}
      <div className="db-preview-body">
        {previewLoading ? (
          <div className="db-preview-loading">
            <span className="db-spinner" />
            Loading preview…
          </div>
        ) : previewError ? (
          <div className="db-preview-unavailable">
            <p>Could not load preview.</p>
            <p className="db-preview-unavailable-sub">{previewError}</p>
          </div>
        ) : preview?.preview == null ? (
          <div className="db-preview-unavailable">
            <p>Preview not available for this file type.</p>
            <p className="db-preview-unavailable-sub">
              You can still import it — text content will be extracted on import.
            </p>
          </div>
        ) : (
          <>
            <pre className="db-preview-text">{preview.preview}</pre>
            {preview.truncated && (
              <p className="db-preview-truncation-note">
                Showing first 3,000 characters — full file will be imported.
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="db-preview-footer">
        <button
          className="db-action-btn db-import-btn"
          onClick={onImport}
          disabled={importing || previewLoading}
        >
          {importing ? "Importing…" : "Import this file"}
        </button>
      </div>
    </div>
  );
}

/**
 * DriveBrowser — a modal file-explorer for Google Drive with inline preview.
 *
 * Props:
 *   isOpen    {boolean}
 *   onClose   {() => void}
 *   onImport  {(fileId) => void}
 *   getToken  {() => Promise<string>}
 *
 * New state vs original:
 *   selectedFile   — the file the user has clicked (not yet imported)
 *   preview        — the API response from GET /api/drive/preview
 *   previewLoading — true while preview fetch is in flight
 *   previewError   — error message string, or null
 */
export default function DriveBrowser({ isOpen, onClose, onImport, getToken }) {
  const [drives, setDrives] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [items, setItems] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(null);

  // ── Preview state ──────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const loadDrives = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const resp = await fetch("/api/drive/drives", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to load drives");

      setDrives(data.drives || []);
      const first = (data.drives || [])[0] || null;
      setSelectedDrive(first);
      setFolderStack([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const loadFiles = useCallback(
    async (pageToken) => {
      if (!selectedDrive) return;
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const currentFolder = folderStack[folderStack.length - 1] || null;

        const params = new URLSearchParams({ pageSize: "50" });
        params.set("driveId", selectedDrive.id);
        if (currentFolder) params.set("folderId", currentFolder.id);
        if (pageToken) params.set("pageToken", pageToken);

        const resp = await fetch("/api/drive/files?" + params.toString(), {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Failed to load files");

        const visibleFiles = (data.files || []).filter(isVisibleInBrowser);

        setItems((prev) =>
          pageToken ? [...prev, ...visibleFiles] : visibleFiles
        );
        setNextPageToken(data.nextPageToken || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedDrive, folderStack, getToken]
  );

  /**
   * loadPreview — fetches the preview for a file from GET /api/drive/preview.
   * Only called for non-folder items. For file types we know can't be
   * previewed we skip the network call and set preview to { preview: null }.
   */
  const loadPreview = useCallback(
    async (file) => {
      setSelectedFile(file);
      setPreview(null);
      setPreviewError(null);

      if (!isImportable(file.mimeType)) {
        // Skip the round-trip — we know the server will return preview: null
        setPreview({ preview: null, truncated: false });
        return;
      }

      setPreviewLoading(true);
      try {
        const token = await getToken();
        const resp = await fetch(
          "/api/drive/preview?" + new URLSearchParams({ fileId: file.id }),
          { headers: { Authorization: "Bearer " + token } }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Failed to load preview");
        setPreview(data);
      } catch (err) {
        setPreviewError(err.message);
      } finally {
        setPreviewLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSelectedFile(null);
    setPreview(null);
    loadDrives();
  }, [isOpen, loadDrives]);

  useEffect(() => {
    if (!selectedDrive) return;
    setSelectedFile(null);
    setPreview(null);
    loadFiles(null);
  }, [selectedDrive, folderStack, loadFiles]);

  // ─── Navigation handlers ───────────────────────────────────────────────────

  const handleSelectDrive = (drive) => {
    setSelectedDrive(drive);
    setFolderStack([]);
    setItems([]);
    setNextPageToken(null);
    setSelectedFile(null);
    setPreview(null);
  };

  const handleOpenFolder = (folder) => {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setItems([]);
    setNextPageToken(null);
    setSelectedFile(null);
    setPreview(null);
  };

  const handleBreadcrumbClick = (index) => {
    setFolderStack((prev) => prev.slice(0, index + 1));
    setItems([]);
    setNextPageToken(null);
    setSelectedFile(null);
    setPreview(null);
  };

  /**
   * handleImport — imports the currently selected (previewed) file.
   * Driven from the PreviewPanel's "Import this file" button rather than
   * individual row buttons, so users always preview before committing.
   */
  const handleImport = async () => {
    if (!selectedFile) return;
    setImporting(selectedFile.id);
    try {
      await onImport(selectedFile.id);
    } finally {
      setImporting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content db-modal db-modal--split"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="modal-header">
          <h3>Browse Google Drive</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* ── Drive selector tabs ─────────────────────────────────────────── */}
        <div className="db-drive-bar">
          {drives.map((drive) => (
            <button
              key={drive.id}
              className={`db-drive-tab${selectedDrive?.id === drive.id ? " active" : ""}`}
              onClick={() => handleSelectDrive(drive)}
            >
              {drive.kind === "personal" ? "🏠" : "🤝"} {drive.name}
            </button>
          ))}
        </div>

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <div className="db-breadcrumb">
          <button className="db-crumb" onClick={() => handleBreadcrumbClick(-1)}>
            {selectedDrive?.name || "My Drive"}
          </button>
          {folderStack.map((folder, i) => (
            <span key={folder.id} className="db-crumb-group">
              <span className="db-crumb-sep">/</span>
              <button
                className="db-crumb"
                onClick={() => handleBreadcrumbClick(i)}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>

        {/* ── Split body: file list + preview ─────────────────────────────── */}
        <div className="db-split-body">

          {/* Left: file / folder list */}
          <div className="modal-body db-body db-body--left">
            {error && <div className="error-alert">{error}</div>}

            {loading && items.length === 0 ? (
              <div className="loading">Loading…</div>
            ) : items.length === 0 ? (
              <div className="empty-state"><p>This folder is empty.</p></div>
            ) : (
              <div className="db-item-list">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`db-item-row${selectedFile?.id === item.id ? " db-item-row--selected" : ""}`}
                    // Clicking anywhere on the row selects it (for files) or opens it (for folders)
                    onClick={() =>
                      item.mimeType === FOLDER_MIME
                        ? handleOpenFolder(item)
                        : loadPreview(item)
                    }
                  >
                    <FileIcon mimeType={item.mimeType} />

                    <div className="db-item-info">
                      <span className="db-item-name">{item.name}</span>
                      <span className="db-item-meta">
                        {formatMimeType(item.mimeType)}
                        {item.modifiedTime
                          ? " · " + new Date(item.modifiedTime).toLocaleDateString()
                          : ""}
                      </span>
                    </div>

                    {item.mimeType === FOLDER_MIME && (
                      <span className="db-folder-chevron">›</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {nextPageToken && (
              <button
                className="db-load-more"
                onClick={() => loadFiles(nextPageToken)}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>

          {/* Right: preview panel */}
          <PreviewPanel
            file={selectedFile}
            preview={preview}
            previewLoading={previewLoading}
            previewError={previewError}
            onImport={handleImport}
            importing={!!importing}
          />
        </div>
      </div>
    </div>
  );
}