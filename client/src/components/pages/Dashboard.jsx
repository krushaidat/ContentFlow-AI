import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import CreateContent from "../CreateContent";
import DriveBrowser from "../DriveBrowser";
import { decrementTemplateUsage } from "../../functions/templateDB";
import "../styles/dashboard.css";
import "../styles/review.css";
import useInPageAlert from "../../hooks/useInPageAlert";
import InPageAlert from "../InPageAlert";

const auth = getAuth();
const READY_TO_POST_LABEL = "Ready To Post";
const READY_TO_POST_STAGE_ALIASES = [
  READY_TO_POST_LABEL,
  "Ready to Post",
  "Ready-To-Post",
];

const isReadyToPostStage = (stage) =>
  READY_TO_POST_STAGE_ALIASES.includes(stage);

const normalizeStageLabel = (stage) =>
  isReadyToPostStage(stage) ? READY_TO_POST_LABEL : stage;

export default function Dashboard() {
  const ALL_STAGES = "All Stages";
  const STAGES = [
  ALL_STAGES,
  "Draft",
  "Review",
  "Update",
  READY_TO_POST_LABEL,
  "Posted",
];
const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
const [selectedPostForSchedule, setSelectedPostForSchedule] = useState(null);

// Abdalaa: manual scheduling should let the user pick any date and time.
// I also added repeat settings so one post can be scheduled more than once.
const [manualSchedule, setManualSchedule] = useState({
  date: "",
  time: "",
  repeatType: "none",
  repeatCount: 1,
});

// Abdalaa: this range is only for AI scheduling.
// Gemini should search for the best free slot inside this window.

const [aiScheduleRangeDays, setAiScheduleRangeDays] = useState(3);

const handleOpenScheduleModal = (item) => {
  // Abdalaa: open the manual scheduling modal for one post
  // and reset the schedule form to a clean default state.
  setSelectedPostForSchedule(item);
  setManualSchedule({
    date: "",
    time: "",
    repeatType: "none",
    repeatCount: 1,
  });
  setScheduleModalOpen(true);
};

const handleCloseScheduleModal = () => {
  // Abdalaa: reset everything when the scheduling modal closes
  // so old values do not stay stuck for the next post.
  setScheduleModalOpen(false);
  setSelectedPostForSchedule(null);
  setManualSchedule({
    date: "",
    time: "",
    repeatType: "none",
    repeatCount: 1,
  });
};

const handleManualScheduleSubmit = async () => {
  try {
    if (!selectedPostForSchedule) return;

    if (!manualSchedule.date || !manualSchedule.time) {
      setScheduleError("Please choose both a date and a time.");
      return;
    }

    setScheduleError(null);

    // Abdalaa: manual scheduling should allow any date/time,
    // and it can also repeat daily, weekly, or monthly.
    const response = await fetch("http://localhost:5000/api/ai/manual-schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postId: selectedPostForSchedule.id,
        userId: user.uid,
        date: manualSchedule.date,
        time: manualSchedule.time,
        repeatType: manualSchedule.repeatType,
        repeatCount: Number(manualSchedule.repeatCount),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to schedule post.");
    }

    handleCloseScheduleModal();
    await fetchContent(user);
    showAlert(`Post scheduled for ${data.date} at ${data.time}`);
  } catch (error) {
    console.error("Error scheduling post manually:", error);
    setScheduleError(error.message || "Could not schedule post.");
  }
};

  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedStage, setSelectedStage] = useState(ALL_STAGES);//Filter stages
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState({ title: "", text: "", stage: "Draft" });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // Aminah updated: state for the version history modal — which item is open, which snapshot index is selected, and whether to view or compare.
  const [historyItem, setHistoryItem] = useState(null);
  const [historyVersionIndex, setHistoryVersionIndex] = useState(-1);
  const [historyViewMode, setHistoryViewMode] = useState("view");
  const [isRevertingHistory, setIsRevertingHistory] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [pendingHighlightId, setPendingHighlightId] = useState(null);
  const [highlightedContentId, setHighlightedContentId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const { alertState, showAlert, dismissAlert } = useInPageAlert();
  const [templateTitles, setTemplateTitles] = useState([]);
  // Drive browser modal visibility
const [driveOpen, setDriveOpen] = useState(false);
const [driveError, setDriveError] = useState(null);
const [driveUploadingId, setDriveUploadingId] = useState(null);
  // Abdalaa: This keeps track of which content card is currently asking AI
  // for a suggested posting time, so the button can show loading state.
  const [schedulingPostId, setSchedulingPostId] = useState(null);

  // Abdalaa: This stores any scheduling error message from the AI suggestion flow.
  const [scheduleError, setScheduleError] = useState(null);
  /** DRAVEN
   * Fetches content from Firestore for the authenticated user.
   * @param {*} user - The authenticated user object.
   * @returns {Promise<void>} - A promise that resolves when the content is fetched.
   */
  /**
   * Tanvir- fetchContent - Fixes user permissions & security rules compliance
   * 
   - Fetches content from Firestore filtered by:
   - Fetches only the currently logged-in user's content from Firestore.
   - Filters by 'createdBy' field matching the user's UID to comply with Firestore security rules.
   * 
   * Removed orderBy("createdAt") to avoid requiring a composite index in Firestore.
   * Instead, sorting is done client-side after fetching to improve performance and reduce quota errors.
   - This ensures users can only access their own content, enforcing data privacy and security.
   */
  const fetchContent = useCallback(async (user) => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      setError("User not authenticated");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Security fix: Filter by createdBy to only fetch user's own content
      // This matches Firestore security rules that allow reading only own documents
      const filters = [where("createdBy", "==", currentUser.uid)];
      if (selectedStage && selectedStage !== ALL_STAGES) {
        if (isReadyToPostStage(selectedStage)) {
          filters.push(where("stage", "in", READY_TO_POST_STAGE_ALIASES));
        } else {
          filters.push(where("stage", "==", selectedStage));
        }
      }
      const q = query(
        collection(db, "content"),
        ...filters
      );
      const querySnapshot = await getDocs(q);
      // Performance fix: Sort on client-side instead of orderBy in query
      // Avoids needing a composite index and reduces quota errors
      const items = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          stage: normalizeStageLabel(data.stage),
        };
      }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setContent(items);
      setError(null);
    } catch (err) {
      console.error("Error fetching content:", err);
      setError("Failed to load content. Check your Firebase permissions.");
    } finally {
      setLoading(false);
    }
  }, [ALL_STAGES, selectedStage]);

  /** DRAVEN
   * Sets up an authentication state listener using Firebase's onAuthStateChanged function.
   * When the authentication state changes (e.g., user signs in or out), this listener is triggered.
   * If a user is authenticated, it fetches the user's content from Firestore.
   * If no user is authenticated, it sets an error message and redirects to the login page.
   * The listener is cleaned up when the component unmounts to prevent memory leaks.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchContent(currentUser);
        fetchTemplateTitles();
      } else {
        setLoading(false);
        setError("Please sign in to view your content");
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [fetchContent, navigate]);
  
  useEffect(() => {
    if (selectedStage) {
      fetchContent();
    }
  }, [fetchContent, selectedStage]);

  useEffect(() => {
    const targetId = location.state?.highlightContentId;
    if (!targetId) return;

    // Ensure the highlighted item is visible in the dashboard list.
    setSearch("");
    setSelectedStage(ALL_STAGES);
    setHighlightedContentId(null);
    setPendingHighlightId(null);

    const frameId = window.requestAnimationFrame(() => {
      setPendingHighlightId(targetId);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [ALL_STAGES, location.state?.highlightContentId, location.state?.notificationId]);

  useEffect(() => {
    if (!pendingHighlightId || content.length === 0) return;

    const exists = content.some((item) => item.id === pendingHighlightId);
    if (!exists) return;

    setHighlightedContentId(pendingHighlightId);
    const el = document.getElementById(`dashboard-content-${pendingHighlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timer = setTimeout(() => {
      setHighlightedContentId(null);
    }, 5000);

    setPendingHighlightId(null);
    return () => clearTimeout(timer);
  }, [pendingHighlightId, content]);


  // Aminah: content menu click outside handler
  useEffect(() => {
    const handleClickOutsideMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutsideMenu);
    return () => document.removeEventListener("mousedown", handleClickOutsideMenu);
  }, []);

  const toggleContentMenu = (e, contentId) => {
    e.stopPropagation();
    setOpenMenuId((currentId) => (currentId === contentId ? null : contentId));
  };

  const fetchTemplateTitles = async () => {
    try{  
      const snapshot = await getDocs(collection(db, "templates"));
      const titleMap={};
      snapshot.forEach((templateDoc) => {
        const data = templateDoc.data() || {};
        titleMap[templateDoc.id] = data.title || "";
      });
      setTemplateTitles(titleMap);
    } catch (err) {
      console.error("Error fetching template titles:", err);
    }
  };
  /**
   * Returns the appropriate CSS class name for a status badge
   * based on the content's current stage (draft, planning, review, etc.)
   * This function maps each stage to its corresponding color scheme
   */
  const getStatusBadgeClass = (stage) => {
    const statusMap = {
      draft: "badge-draft",
      planning: "badge-planning",
      review: "badge-review",
      update: "badge-update",
      "ready to post": "badge-ready",
    };
    return statusMap[stage?.toLowerCase()] || "badge-draft";
  };

  /**
   * Formats a date string into a human-readable format
   * Example output: "Jan 15, 2024"
   * Used to display creation dates in a user-friendly way
   */
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /**
   * Handles when the user clicks the edit icon on a content card
   - Stops the click from bubbling up (prevents unwanted parent actions)
   - Opens the edit modal by setting the editingId
   - Populates the form fields with the current content data
   * @param {Event} e - The click event
   * @param {Object} item - The content item to edit
   */
  const handleEditClick = (e, item) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingContent({
      title: item.title,
      text: item.text,
      stage: item.stage,
    });
  };

  /**
   * Handles when the user clicks the delete icon on a content card
   - Stops the click from bubbling up
   - Opens a confirmation popup to prevent accidental deletion
   * @param {Event} e - The click event
   * @param {string} contentId - The ID of the content to delete
   */
  const handleDeleteClick = (e, contentId) => {
    e.stopPropagation();
    setPendingDeleteId(contentId);
  };

  // Aminah update: open the content version history modal from a dashboard card.
  const handleViewHistory = (e, item) => {
    e.stopPropagation();
    const history = Array.isArray(item.versionHistory) ? item.versionHistory : [];
    setHistoryVersionIndex(history.length > 0 ? history.length - 1 : -1);
    setHistoryViewMode("view");
    setShowRevertConfirm(false);
    setHistoryItem(item);
  };
  
  // Aminah update: open the content version history modal in compare mode, which highlights field changes between the selected snapshot and the current version.

  const closeHistoryModal = () => {
    setHistoryItem(null);
    setHistoryVersionIndex(-1);
    setHistoryViewMode("view");
    setShowRevertConfirm(false);
  };

  // Aminah updated: format a versionHistory snapshotAt timestamp into a readable locale string.
  const formatHistoryTimestamp = (value) => {
    if (!value) return "Unknown time";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "Unknown time" : parsed.toLocaleString();
  };

  // Aminah updated: returns true when a specific field differs between a past snapshot and the current item, used to highlight changed fields in compare mode.
  const historyFieldChanged = (snapshot, field, current) =>
    (snapshot?.[field] || "") !== (current?.[field] || "");

  const handleRevertHistoryVersion = () => {
    const history = Array.isArray(historyItem?.versionHistory)
      ? historyItem.versionHistory
      : [];
    const selectedSnapshot =
      historyVersionIndex >= 0 && historyVersionIndex < history.length
        ? history[historyVersionIndex]
        : null;

    if (!historyItem || !selectedSnapshot || !user?.uid) {
      showAlert("Select a saved version to revert to first.", "warning");
      return;
    }

  // Aminah updated: when the user clicks "Revert to this version", show a confirmation popup before actually reverting, to prevent accidental reverts.
    setShowRevertConfirm(true);
  };

  const confirmRevertHistoryVersion = async () => {
    const history = Array.isArray(historyItem?.versionHistory)
      ? historyItem.versionHistory
      : [];
    const selectedSnapshot =
      historyVersionIndex >= 0 && historyVersionIndex < history.length
        ? history[historyVersionIndex]
        : null;

    if (!historyItem || !selectedSnapshot || !user?.uid) {
      setShowRevertConfirm(false);
      showAlert("Select a saved version to revert to first.", "warning");
      return;
    }

    try {
      setShowRevertConfirm(false);
      setIsRevertingHistory(true);

      const response = await fetch("http://localhost:5000/api/team/content-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authorId: user.uid,
          contentId: historyItem.id,
          title: selectedSnapshot.title || "",
          text: selectedSnapshot.text || "",
          stage: selectedSnapshot.stage || "Draft",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to revert version");
      }

      await fetchContent(user);
      closeHistoryModal();
      showAlert(
        data.assignedReviewerId
          ? "Version reverted successfully and reviewer assignment was restored."
          : "Version reverted successfully.",
        "success"
      );
    } catch (revertError) {
      console.error("Error reverting content version:", revertError);
      showAlert(revertError.message || "Failed to revert version.", "error");
    } finally {
      setIsRevertingHistory(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;

    const deletedItem = content.find((item) => item.id === pendingDeleteId);

    try {
      await deleteDoc(doc(db, "content", pendingDeleteId));

      // If this content used a saved template, decrement its popularity count
      if (deletedItem?.templateId) {
        try {
          await decrementTemplateUsage(deletedItem.templateId);
        } catch (decErr) {
          console.warn("Failed to decrement template usage:", decErr);
        }
      }
      setPendingDeleteId(null);
      fetchContent(user);
    } catch (error) {
      console.error("Error deleting content:", error);
      setError("Failed to delete content");
    }
  };

  const handleSuggestPostingTime = async (item) => {
    try {
      setSchedulingPostId(item.id);
      setScheduleError(null);
  
      // Abdalaa: AI scheduling should search for the best free slot
      // inside the selected future window.
      const response = await fetch("http://localhost:5000/api/ai/suggest-post-time", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: item.id,
          userId: user.uid,
          rangeDays: Number(aiScheduleRangeDays),
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || "Failed to suggest posting time.");
      }
  
      await fetchContent(user);
  
      const sourceLabel =
        data.source === "gemini"
          ? "Gemini picked the best free slot"
          : "Fallback picked the first free slot because Gemini response was invalid";
  
      showAlert(
        `${sourceLabel}\nScheduled for ${data.suggestedDate} at ${data.suggestedTime}`
      );
    } catch (error) {
      console.error("Error suggesting posting time:", error);
      setScheduleError(error.message || "Could not suggest posting time.");
    } finally {
      setSchedulingPostId(null);
    }
  };

  /**
   - Updates the document in the database with new title, text, and status
   - Closes the modal after successful save
   - Refreshes the content list to show updated data
   - Displays error message if the save fails
   */
  const handleSaveChanges = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/team/content-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authorId: user?.uid,
          contentId: editingId,
          title: editingContent.title,
          text: editingContent.text,
          stage: editingContent.stage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update content");
      }

      setEditingId(null);
      fetchContent(user);
      if (editingContent.stage === "Review") {
        showAlert(
          data.assignedReviewerId
            ? "Content moved to Review and a reviewer was assigned automatically."
            : "Content moved to Review.",
          "success"
        );
      } else {
        showAlert("Content updated successfully.", "success");
      }
    } catch (error) {
      console.error("Error updating content:", error);
      setError(error.message || "Failed to update content");
    }
  };

  /**
   - Closes the edit modal without saving any changes
   - Resets the editingId to null (closes the modal)
   - Clears the form fields back to default values
   */
  const handleCloseEdit = () => {
    setEditingId(null);
    setEditingContent({ title: "", text: "", stage: "Draft" });
  };

  // AMINAH: Navigates to the Templates management page when "Manage Templates" button is clicked

  const handleManageTemplates = () => {
   navigate("/templates");
  };


  const getAuthToken = async () => {
    const current = auth.currentUser;
    if (current) {
      return await current.getIdToken(true);
    }
    return null;
  };

  const handleConnectDrive = async () => {
  try {
    const token = await getAuthToken();
    if (!token) {
      setDriveError("You must be signed in.");
      return;
    }

    const response = await fetch("/api/drive/oauth/start", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await response.json();
    if (!response.ok || !data.authUrl) {
      const detail = data.detail ? ` (${data.detail})` : "";
      throw new Error((data.error || "Failed to start Drive connection.") + detail);
    }

    window.location.href = data.authUrl;
  } catch (error) {
    console.error("Connect Drive error:", error);
    setDriveError(error.message || "Could not connect Drive.");
  }
};

/**
 * ensureDriveConnected — checks whether the user already has an active
 * Drive integration. If not connected, it starts the OAuth flow.
 * Returns true only when already connected in the current session.
 */
const ensureDriveConnected = async () => {
  const token = await getAuthToken();
  if (!token) {
    setDriveError("You must be signed in.");
    return false;
  }

  const response = await fetch("/api/drive/status", {
    method: "GET",
    headers: { Authorization: "Bearer " + token }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not check Drive status.");
  }

  if (!data.connected) {
    showAlert("Please connect Google Drive to continue.");
    await handleConnectDrive();
    return false;
  }

  return true;
};

/**
 * handleOpenDriveBrowser — opens the Drive browser only when the user is
 * already connected. If not connected, it triggers OAuth first.
 */
const handleOpenDriveBrowser = async () => {
  try {
    setDriveError(null);
    const connected = await ensureDriveConnected();
    if (!connected) return;
    setDriveOpen(true);
  } catch (error) {
    console.error("Open Drive browser error:", error);
    setDriveError(error.message || "Could not open Drive browser.");
  }
};

/**
 * handleImportFromDrive — called by DriveBrowser when the user clicks
 * "Import" on a file. Sends the fileId to the backend, which fetches
 * the file text from Drive and creates a new Firestore content document.
 */
const handleImportFromDrive = async (fileId) => {
  const token = await getAuthToken();
  if (!token) throw new Error("You must be signed in.");

  const response = await fetch("/api/drive/import-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ fileId })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Import failed.");

  setDriveOpen(false);
  await fetchContent(user);
  showAlert("Imported from Drive: " + (data.title || "Untitled"));
};

const handleUploadContentToDrive = async (item) => {
  try {
    setDriveUploadingId(item.id);
    setDriveError(null);

    const connected = await ensureDriveConnected();
    if (!connected) return;

    const token = await getAuthToken();
    if (!token) {
      throw new Error("You must be signed in.");
    }

    const response = await fetch("/api/drive/upload-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ contentId: item.id })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }

    await fetchContent(user);
    showAlert("Uploaded to Drive successfully.");
  } catch (error) {
    console.error("Upload to Drive error:", error);
    setDriveError(error.message || "Could not upload content to Drive.");
  } finally {
    setDriveUploadingId(null);
  }
};

  if (!user && !loading) {
    return (
      <div className="dashboard">
        <div className="error-alert">
          Please sign in to access your content.
        </div>
      </div>
    );
  }
  const filteredContent = content.filter((item) => {
    const title = (item.title || "").toLowerCase();
    const text = (item.text || "").toLowerCase();
    const query = search.toLowerCase();
    return title.includes(query) || text.includes(query);
  });
  
 
  return (
    <div className="dashboard-main">
      <InPageAlert alertState={alertState} onClose={dismissAlert} />
      {/* AMINAH: Top section with Create Content and Templates in a horizontal flex container */}
      <div className="dashboard-top-row">
        <div className="dashboard-card create-content-card">
          {/* AMINAH: Create Content card */}
          <div className="dashboard-card-icon">
            <span role="img" aria-label="Create Content" style={{fontSize: 32}}>📝</span>
          </div>
          <div className="dashboard-card-body">
            <div className="dashboard-card-title">Create Content</div>
            <div className="dashboard-card-desc">Start a new post and write your content.</div>
            <div className="dashboard-create-actions">
              <button className="dashboard-card-btn" onClick={() => setIsModalOpen(true)}>
                + Create Content
              </button>
              <button
                className="dashboard-card-btn secondary drive-btn"
                onClick={handleOpenDriveBrowser}
              >
                Import from Drive
              </button>
            </div>
          </div>
        </div>
        <div className="dashboard-card templates-card">
          {/* AMINAH: Templates card */}
          <div className="dashboard-card-icon">
            <span role="img" aria-label="Templates" style={{fontSize: 32}}>📄</span>
          </div>
          <div className="dashboard-card-body">
          <div className="dashboard-card-title">AI Guidelines</div>
          <div className="dashboard-card-desc">
            Manage AI validation guidelines used to check content quality and brand consistency.
          </div>
            <button className="dashboard-card-btn secondary" onClick={handleManageTemplates}>
            Manage AI Guidelines            </button>
          </div>
        </div>
      </div>
      <div className="dashboard-toolbar">
        <div className="dashboard-search-wrap">
          <input type="text" className="dashboard-search-input" placeholder="Search content..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        <div className="dashboard-filter-wrap">
          <span className="dashboard-filter-label">Stage</span>
          <select className="dashboard-stage-select" value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)}>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </div>
      </div>
    

      {/* AMINAH: CreateContent modal */}
      <CreateContent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchContent(user)}
      />

      {/* Drive file browser — supports exploring My Drive, Shared Drives,
          and sub-folders before choosing a file to import */}
      <DriveBrowser
        isOpen={driveOpen}
        onClose={() => setDriveOpen(false)}
        getToken={getAuthToken}
        onImport={handleImportFromDrive}
      />

      {/* AMINAH: Templates Modal */}


      {/* AMINAH: Section title */}
      <h2 className="dashboard-section-title">My Content</h2>

      {error && <div className="error-alert">{error}</div>}
      {scheduleError && <div className="error-alert">{scheduleError}</div>}
      {driveError && <div className="error-alert">{driveError}</div>}

      {loading ? (
        <div className="loading">Loading your content...</div>
      ) : filteredContent.length === 0 ? (
        <div className="empty-state">
          <p>No content yet. Create your first piece of content!</p>
        </div>
      ) : (
        <div className="dashboard-content-list">
          {filteredContent.map((item) => (
            <div
              id={`dashboard-content-${item.id}`}
              key={item.id}
              className={`dashboard-content-card content-item-box ${highlightedContentId === item.id ? "notification-highlight" : ""}`}
            >
              {/* AMINAH: Content item box container */}
              <div className="dashboard-content-header">
                <span className={`dashboard-badge ${getStatusBadgeClass(item.stage)}`}>{item.stage || "Draft"}</span>
                {/*- Moved edit and delete buttons from `.dashboard-content-actions` at the bottom to `.dashboard-content-header` at the top
                  - Buttons now positioned at top-right of each card*/}
                <div className="dashboard-content-actions" ref={openMenuId === item.id ? menuRef : null}>
                  <button
                    type="button"
                    className="icon-btn more"
                    onClick={(e) => toggleContentMenu(e, item.id)}
                    title="More options"
                    aria-label={`More options for ${item.title || "content"}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === item.id}
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="1.75" fill="currentColor" stroke="none" />
                      <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
                      <circle cx="12" cy="19" r="1.75" fill="currentColor" stroke="none" />
                    </svg>
                  </button>

                  {openMenuId === item.id && (
                    <div className="dashboard-content-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="dashboard-content-menu-item"
                        onClick={(e) => {
                          setOpenMenuId(null);
                          handleViewHistory(e, item);
                        }}
                      >
                        Version History
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="dashboard-content-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          handleUploadContentToDrive(item);
                        }}
                        disabled={driveUploadingId === item.id}
                      >
                        {driveUploadingId === item.id ? "Uploading..." : "Upload to Drive"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="dashboard-content-menu-item"
                        onClick={(e) => {
                          setOpenMenuId(null);
                          handleEditClick(e, item);
                        }}
                      >
                        Edit Content
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="dashboard-content-menu-item danger"
                        onClick={(e) => {
                          setOpenMenuId(null);
                          handleDeleteClick(e, item.id);
                        }}
                      >
                        Delete Content
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="content-item-title">{item.title}</div>
              <div className="content-item-text">{item.text}</div>
              {item.rejectionReason && !isReadyToPostStage(item.stage) && (
                <div className="rejection-reason">
                  <strong>Feedback:</strong> {item.rejectionReason}
                </div>
              )}
              <div className="content-item-meta">
                <span className="content-item-stage">Stage: {item.stage}</span>
                <span className="content-item-date">{item.createdAt ? formatDate(item.createdAt) : "Invalid Date"}</span>
              </div>
              <div className="dashboard-content-type">{item.type || templateTitles[item.templateId] || item.category || item.name || "Company Announcement"}</div>
              
                {/* Abdalaa: I only want the scheduling buttons to show
                    once the post is actually in the Ready to Post stage. */}
                {isReadyToPostStage(item.stage) && (
  <div className="schedule-actions-row">
    <button
      className="schedule-action-btn ai-schedule-btn"
      onClick={() => handleSuggestPostingTime(item)}
      disabled={schedulingPostId === item.id}
      title="Let AI find the best posting time"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 6H8l4 6 4-6h-2c0-3 2-4 2-6a4 4 0 0 0-4-4z"/><path d="M8 18h8"/><path d="M9 22h6"/></svg>
      {schedulingPostId === item.id ? "Suggesting..." : "AI Schedule"}
    </button>
    <button
      className="schedule-action-btn manual-schedule-btn"
      onClick={() => handleOpenScheduleModal(item)}
      title="Manually schedule this post"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Schedule
    </button>
  </div>
)}

            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="modal-overlay" onClick={handleCloseEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Content</h3>
              <button className="modal-close" onClick={handleCloseEdit}>×</button>
            </div>
            
            <div className="modal-body">
              <form className="edit-form" onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
                <div className="form-group">
                  <label htmlFor="edit-title">Title</label>
                  <input
                    id="edit-title"
                    type="text"
                    value={editingContent.title}
                    onChange={(e) => setEditingContent({ ...editingContent, title: e.target.value })}
                    className="edit-input"
                    placeholder="Title"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-text">Content</label>
                  <textarea
                    id="edit-text"
                    value={editingContent.text}
                    onChange={(e) => setEditingContent({ ...editingContent, text: e.target.value })}
                    className="edit-textarea"
                    placeholder="Content"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-stage">Stage</label>
                  <select
                    id="edit-stage"
                    value={editingContent.stage}
                    onChange={(e) => setEditingContent({ ...editingContent, stage: e.target.value })}
                    className="edit-select"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Planning">Planning</option>
                    <option value="Review">Review</option>
                    <option value="Update">Update</option>
                    <option value="Ready To Post">Ready To Post</option>
                  </select>
                </div>
                
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={handleCloseEdit}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-save">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
{scheduleModalOpen && selectedPostForSchedule && (
  <div className="modal-overlay" onClick={handleCloseScheduleModal}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Schedule Post</h3>
        <button className="modal-close" onClick={handleCloseScheduleModal}>×</button>
      </div>

      <div className="modal-body">
        {/* AI Scheduling Section */}
        <div className="schedule-section">
          <div className="schedule-section-label">AI Scheduling</div>
          <div className="schedule-ai-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="ai-schedule-range">Search Window</label>
              <select
                id="ai-schedule-range"
                className="edit-select"
                value={aiScheduleRangeDays}
                onChange={(e) => setAiScheduleRangeDays(Number(e.target.value))}
              >
                <option value={1}>Next 1 day</option>
                <option value={2}>Next 2 days</option>
                <option value={3}>Next 3 days</option>
                <option value={7}>Next 7 days</option>
              </select>
            </div>
            <button
              type="button"
              className="btn-save schedule-ai-btn"
              onClick={() => {
                handleCloseScheduleModal();
                handleSuggestPostingTime(selectedPostForSchedule);
              }}
              disabled={schedulingPostId === selectedPostForSchedule?.id}
            >
              {schedulingPostId === selectedPostForSchedule?.id ? "Finding..." : "Find Best Time"}
            </button>
          </div>
        </div>

        <div className="schedule-divider">
          <span>or schedule manually</span>
        </div>

        {/* Manual Scheduling Section */}
      <div className="form-group">
  <label htmlFor="manual-schedule-date">Date</label>
  <input
    id="manual-schedule-date"
    type="date"
    value={manualSchedule.date}
    onChange={(e) =>
      setManualSchedule({ ...manualSchedule, date: e.target.value })
    }
    className="edit-input"
  />
</div>

<div className="form-group">
  <label htmlFor="manual-schedule-time">Time</label>
  <input
    id="manual-schedule-time"
    type="time"
    value={manualSchedule.time}
    onChange={(e) =>
      setManualSchedule({ ...manualSchedule, time: e.target.value })
    }
    className="edit-input"
  />
</div>

<div className="form-group">
  <label htmlFor="manual-repeat-type">Repeat</label>
  <select
    id="manual-repeat-type"
    value={manualSchedule.repeatType}
    onChange={(e) =>
      setManualSchedule({ ...manualSchedule, repeatType: e.target.value })
    }
    className="edit-select"
  >
    <option value="none">Do not repeat</option>
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
  </select>
</div>

{manualSchedule.repeatType !== "none" && (
  <div className="form-group">
    <label htmlFor="manual-repeat-count">Repeat Count</label>
    <input
      id="manual-repeat-count"
      type="number"
      min="1"
      max="30"
      value={manualSchedule.repeatCount}
      onChange={(e) =>
        setManualSchedule({
          ...manualSchedule,
          repeatCount: Number(e.target.value),
        })
      }
      className="edit-input"
    />
  </div>
)}
          

        <div className="modal-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={handleCloseScheduleModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={handleManualScheduleSubmit}
          >
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  </div>
)}
      {pendingDeleteId && (
        <div className="modal-overlay" onClick={() => setPendingDeleteId(null)}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-confirm-header">
              <button className="modal-close" onClick={() => setPendingDeleteId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="delete-confirm-message">Are you sure you want to delete this content?</p>
              <div className="modal-actions delete-confirm-actions">
                <button type="button" className="btn-cancel" onClick={() => setPendingDeleteId(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-save" onClick={handleConfirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aminah updated: version history modal — shows past snapshots for the selected content item with optional compare mode. */}
      {historyItem && (() => {
        const history = Array.isArray(historyItem.versionHistory) ? historyItem.versionHistory : [];
        const selectedSnapshot =
          historyVersionIndex >= 0 && historyVersionIndex < history.length
            ? history[historyVersionIndex]
            : null;

        return (
          <div className="modal-overlay" onClick={closeHistoryModal}>
            <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Version History</h3>
                <button className="modal-close" onClick={closeHistoryModal}>×</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: 12 }}>
                  <strong>{historyItem.title}</strong>
                  <span className="history-version-count">
                    {history.length === 0 ? " — no past versions yet" : ` — ${history.length} saved version${history.length === 1 ? "" : "s"}`}
                  </span>
                </p>

                <div className="compare-view-header-row" style={{ marginBottom: 12, justifyContent: "flex-end" }}>
                  {selectedSnapshot && (
                    <div className="history-view-toggle">
                      <button
                        type="button"
                        className={`history-toggle-btn ${historyViewMode === "view" ? "active" : ""}`}
                        onClick={() => {
                          setHistoryViewMode("view");
                          setShowRevertConfirm(false);
                        }}
                      >
                        View version
                      </button>
                      <button
                        type="button"
                        className={`history-toggle-btn ${historyViewMode === "compare" ? "active" : ""}`}
                        onClick={() => {
                          setHistoryViewMode("compare");
                          setShowRevertConfirm(false);
                        }}
                      >
                        Compare
                      </button>
                    </div>
                  )}
                  <select
                    className="compare-version-select"
                    value={historyVersionIndex}
                    onChange={(e) => {
                      setHistoryVersionIndex(Number(e.target.value));
                      setHistoryViewMode("view");
                      setShowRevertConfirm(false);
                    }}
                  >
                    <option value={-1}>Current version only</option>
                    {history.map((version, idx) => (
                      <option key={`${version.snapshotAt || "v"}-${idx}`} value={idx}>
                        {`v${idx + 1} · ${formatHistoryTimestamp(version.snapshotAt)} · ${
                          version.changeType === "manual_edit" ? "Manual edit"
                          : version.changeType === "review_approved" ? "Approved"
                          : version.changeType === "review_rejected" ? "Rejected"
                          : version.changeType || "Edit"
                        }`}
                      </option>
                    ))}
                  </select>
                </div>

                {historyViewMode === "view" && selectedSnapshot ? (
                  <div className="compare-grid compare-grid-single">
                    <div className="compare-card old-version">
                      <div className="compare-card-title">Past Version (v{historyVersionIndex + 1})</div>
                      <p>
                        <strong>Title:</strong> {selectedSnapshot.title || "(empty)"}
                      </p>
                      <p>
                        <strong>Stage:</strong> {selectedSnapshot.stage || "Draft"}
                      </p>
                      <p>
                        <strong>Text:</strong> {selectedSnapshot.text || "(empty)"}
                      </p>
                      <p className="history-snapshot-meta">Saved: {formatHistoryTimestamp(selectedSnapshot.snapshotAt)}</p>
                      {selectedSnapshot.reason && <p className="history-snapshot-meta">Reason: {selectedSnapshot.reason}</p>}
                    </div>
                  </div>
                ) : (
                  <div className={`compare-grid ${selectedSnapshot ? "" : "compare-grid-single"}`}>
                    {selectedSnapshot && (
                      <div className="compare-card old-version">
                        <div className="compare-card-title">Past Version (v{historyVersionIndex + 1})</div>
                        <p className={historyFieldChanged(selectedSnapshot, "title", historyItem) ? "compare-changed" : ""}>
                          <strong>Title:</strong> {selectedSnapshot.title || "(empty)"}
                        </p>
                        <p className={historyFieldChanged(selectedSnapshot, "stage", historyItem) ? "compare-changed" : ""}>
                          <strong>Stage:</strong> {selectedSnapshot.stage || "Draft"}
                        </p>
                        <p className={historyFieldChanged(selectedSnapshot, "text", historyItem) ? "compare-changed" : ""}>
                          <strong>Text:</strong> {selectedSnapshot.text || "(empty)"}
                        </p>
                        <p className="history-snapshot-meta">Saved: {formatHistoryTimestamp(selectedSnapshot.snapshotAt)}</p>
                        {selectedSnapshot.reason && <p className="history-snapshot-meta">Reason: {selectedSnapshot.reason}</p>}
                      </div>
                    )}

                    <div className="compare-card new-version current-version-card">
                      <div className="compare-card-title">Current Version</div>
                      <p className={selectedSnapshot && historyFieldChanged(selectedSnapshot, "title", historyItem) ? "compare-changed" : ""}>
                        <strong>Title:</strong> {historyItem.title || "(empty)"}
                      </p>
                      <p className={selectedSnapshot && historyFieldChanged(selectedSnapshot, "stage", historyItem) ? "compare-changed" : ""}>
                        <strong>Stage:</strong> {historyItem.stage || "Draft"}
                      </p>
                      <p className={selectedSnapshot && historyFieldChanged(selectedSnapshot, "text", historyItem) ? "compare-changed" : ""}>
                        <strong>Text:</strong> {historyItem.text || "(empty)"}
                      </p>
                      <p className="history-snapshot-meta">Last updated: {historyItem.updatedAt ? formatHistoryTimestamp(historyItem.updatedAt) : historyItem.createdAt ? formatDate(historyItem.createdAt) : "Unknown"}</p>
                    </div>
                  </div>
                )}

                {history.length === 0 && (
                  <div className="history-empty-hint">
                    Version snapshots are created automatically whenever you edit and save this content or a reviewer makes a decision.
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ justifyContent: "space-between", gap: 12 }}>
                <button
                  type="button"
                  className="btn-warning"
                  onClick={handleRevertHistoryVersion}
                  disabled={!selectedSnapshot || isRevertingHistory}
                >
                  {isRevertingHistory ? "Reverting..." : "Revert to this version"}
                </button>
                <button className="btn-secondary" onClick={closeHistoryModal}>Close</button>
              </div>

              {showRevertConfirm && selectedSnapshot && (
                <div className="history-confirm-overlay" onClick={() => setShowRevertConfirm(false)}>
                  <div className="history-confirm-dialog" onClick={(e) => e.stopPropagation()}>
                    <h4>Revert to version v{historyVersionIndex + 1}?</h4>
                    <p>
                      This will replace the current title, stage, and text with the selected saved version.
                    </p>
                    <div className="history-confirm-actions">
                      <button type="button" className="btn-cancel" onClick={() => setShowRevertConfirm(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-warning"
                        onClick={confirmRevertHistoryVersion}
                        disabled={isRevertingHistory}
                      >
                        {isRevertingHistory ? "Reverting..." : "Yes, revert version"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}