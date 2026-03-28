import { useState, useEffect, useCallback } from "react";
import "./styles/driveBrowser.css";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * FileIcon — renders an emoji icon appropriate for the file's MIME type.
 * Folders, Google Docs, Sheets, Slides, images, and generic files all
 * get distinct icons so the user can scan the list at a glance.
 */
function FileIcon({ mimeType }) {
  if (mimeType === FOLDER_MIME)
    return <span className="db-icon">📁</span>;
  if (mimeType === "application/vnd.google-apps.document")
    return <span className="db-icon">📄</span>;
  if (mimeType === "application/vnd.google-apps.spreadsheet")
    return <span className="db-icon">📊</span>;
  if (mimeType === "application/vnd.google-apps.presentation")
    return <span className="db-icon">📽</span>;
  if (mimeType?.startsWith("image/"))
    return <span className="db-icon">🖼</span>;
  return <span className="db-icon">📎</span>;
}

/**
 * formatMimeType — converts a raw MIME type string into a short, human-
 * readable label shown under each file name (e.g. "Google document",
 * "image/png" stays as-is for non-Google types).
 */
function formatMimeType(mimeType) {
  if (!mimeType) return "";
  if (mimeType === FOLDER_MIME) return "Folder";
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    return "Google " + mimeType.replace("application/vnd.google-apps.", "");
  }
  return mimeType;
}

/**
 * DriveBrowser — a modal file-explorer for Google Drive.
 *
 * Props:
 *   isOpen    {boolean}          — controls visibility
 *   onClose   {() => void}       — called when the user dismisses the modal
 *   onImport  {(fileId) => void} — called with the chosen file's Drive ID
 *   getToken  {() => Promise<string>} — async function that returns a Firebase
 *                                        ID token for authenticating API calls
 *
 * Internal state manages:
 *   drives       — list of drives (My Drive + Shared Drives) for the tab bar
 *   selectedDrive — which drive is currently active
 *   folderStack  — breadcrumb stack: each entry is { id, name } for a folder
 *                  the user has navigated into; index 0 = first sub-folder,
 *                  last = the currently open folder
 *   items        — files/folders in the current view
 *   nextPageToken — Drive API cursor; null means no more pages
 *   importing    — the fileId currently being imported (for loading state)
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

  /**
   * loadDrives — fetches the user's drives from GET /api/drive/drives.
   * On success it auto-selects My Drive so the browser opens with a
   * usable state immediately.
   */
  const loadDrives = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const resp = await fetch("/api/drive/drives", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to load drives");

      setDrives(data.drives || []);
      // Auto-select the first drive (always My Drive) on open
      const first = (data.drives || [])[0] || null;
      setSelectedDrive(first);
      setFolderStack([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  /**
   * loadFiles — fetches a page of items from GET /api/drive/files.
   * Passing a non-null pageToken appends to the existing list ("Load more").
   * Passing null replaces the list (fresh navigation).
   *
   * driveId and folderId are derived from the current selectedDrive and the
   * last entry in folderStack, so callers don't need to pass them explicitly.
   */
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
          headers: { Authorization: "Bearer " + token }
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Failed to load files");

        // Append on "Load more", replace on fresh navigation
        setItems((prev) =>
          pageToken ? [...prev, ...(data.files || [])] : data.files || []
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


  // Load drives whenever the modal is opened
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    loadDrives();
  }, [isOpen, loadDrives]);

  // Reload file list whenever the active drive or folder changes
  useEffect(() => {
    if (!selectedDrive) return;
    loadFiles(null); // null pageToken = fresh load, not a "load more"
  }, [selectedDrive, folderStack, loadFiles]);

  // ─── Navigation handlers ────────────────────────────────────────────────────

  /**
   * handleSelectDrive — switches to a different drive tab.
   * Resets the folder stack and file list so the user starts at the drive root.
   */
  const handleSelectDrive = (drive) => {
    setSelectedDrive(drive);
    setFolderStack([]);
    setItems([]);
    setNextPageToken(null);
  };

  /**
   * handleOpenFolder — pushes a folder onto the breadcrumb stack.
   * The useEffect watching folderStack triggers a fresh loadFiles call.
   */
  const handleOpenFolder = (folder) => {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setItems([]);
    setNextPageToken(null);
  };

  /**
   * handleBreadcrumbClick — navigates back to any ancestor in the breadcrumb.
   * index -1 = go all the way back to the drive root.
   * index  0 = go back to the first sub-folder.
   * etc.
   */
  const handleBreadcrumbClick = (index) => {
    setFolderStack((prev) => prev.slice(0, index + 1));
    setItems([]);
    setNextPageToken(null);
  };

  /**
   * handleImport — calls the onImport prop with the chosen file ID.
   * Sets importing state so the button shows a loading indicator while the
   * parent component (Dashboard) runs the import API call.
   */
  const handleImport = async (file) => {
    setImporting(file.id);
    try {
      await onImport(file.id);
    } finally {
      setImporting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content db-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="modal-header">
          <h3>Browse Google Drive</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* ── Drive selector tabs ─────────────────────────────────────────── */}
        {/* One pill tab per drive: "🏠 My Drive" and "🤝 <Shared Drive name>" */}
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
        {/* Shows: My Drive / Folder A / Folder B  — each segment is clickable */}
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

        {/* ── File / folder list ──────────────────────────────────────────── */}
        <div className="modal-body db-body">
          {error && <div className="error-alert">{error}</div>}

          {loading && items.length === 0 ? (
            <div className="loading">Loading...</div>
          ) : items.length === 0 ? (
            <div className="empty-state"><p>This folder is empty.</p></div>
          ) : (
            <div className="db-item-list">
              {items.map((item) => (
                <div key={item.id} className="db-item-row">
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

                  {/* Folders get an "Open" button; files get an "Import" button */}
                  {item.mimeType === FOLDER_MIME ? (
                    <button
                      className="db-action-btn db-open-btn"
                      onClick={() => handleOpenFolder(item)}
                    >
                      Open
                    </button>
                  ) : (
                    <button
                      className="db-action-btn db-import-btn"
                      onClick={() => handleImport(item)}
                      disabled={importing === item.id}
                    >
                      {importing === item.id ? "Importing…" : "Import"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination — only shown when Drive returned a nextPageToken */}
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
      </div>
    </div>
  );
}
