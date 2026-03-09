import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import CreateContent from "../CreateContent";
import { decrementTemplateUsage } from "../../functions/templateDB";
import "../styles/dashboard.css";

export default function Dashboard() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState({ title: "", text: "", stage: "Draft" });
  
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const auth = getAuth();
  /** DRAVEN
   * Sets up an authentication state listener using Firebase's onAuthStateChanged function.
   * When the authentication state changes (e.g., user signs in or out), this listener is triggered.
   * If a user is authenticated, it fetches the user's content from Firestore.
   * If no user is authenticated, it sets an error message and redirects to the login page.
   * The listener is cleaned up when the component unmounts to prevent memory leaks.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Only fetch content if user is authenticated
        // Prevents "User not authenticated" errors
        fetchContent();
      } else {
        setLoading(false);
        setError("Please sign in to view your content");
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

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
  const fetchContent = async (user) => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      setError("User not authenticated");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Security fix: Filter by createdBy to only fetch user's own content
      // This matches Firestore security rules that allow reading only own documents
      const q = query(
        collection(db, "content"),
        where("createdBy", "==", currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      // Performance fix: Sort on client-side instead of orderBy in query
      // Avoids needing a composite index and reduces quota errors
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setContent(items);
      setError(null);
    } catch (err) {
      console.error("Error fetching content:", err);
      setError("Failed to load content. Check your Firebase permissions.");
    } finally {
      setLoading(false);
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
      "ready-to-post": "badge-ready",
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

  /**
   - Updates the document in the database with new title, text, and status
   - Closes the modal after successful save
   - Refreshes the content list to show updated data
   - Displays error message if the save fails
   */
  const handleSaveChanges = async () => {
    try {
      const contentRef = doc(db, "content", editingId);
      await updateDoc(contentRef, {
        title: editingContent.title,
        text: editingContent.text,
        stage: editingContent.stage,
      });
      setEditingId(null);
      fetchContent(user);
    } catch (error) {
      console.error("Error updating content:", error);
      setError("Failed to update content");
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


  if (!user && !loading) {
    return (
      <div className="dashboard">
        <div className="error-alert">
          Please sign in to access your content.
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-main">
      {/* AMINAH: Top section with Create Content and Templates in a horizontal flex container */}
      <div className="dashboard-top-row">
        <div className="dashboard-card create-content-card">
          {/* AMINAH: Create Content card */}
          <div className="dashboard-card-icon">
            <span role="img" aria-label="Create Content" style={{fontSize: 32}}>📝</span>
          </div>
          <div className="dashboard-card-body">
            <div className="dashboard-card-title">Create Content</div>
            <div className="dashboard-card-desc">Start a new post. Choose a template and write your content.</div>
            <button className="dashboard-card-btn" onClick={() => setIsModalOpen(true)}>
              + Create Content
            </button>
          </div>
        </div>
        <div className="dashboard-card templates-card">
          {/* AMINAH: Templates card */}
          <div className="dashboard-card-icon">
            <span role="img" aria-label="Templates" style={{fontSize: 32}}>📄</span>
          </div>
          <div className="dashboard-card-body">
            <div className="dashboard-card-title">Templates</div>
            <div className="dashboard-card-desc">Manage and modify templates to ensure brand consistency.</div>
            <button className="dashboard-card-btn secondary" onClick={handleManageTemplates}>
              Manage Templates
            </button>
          </div>
        </div>
      </div>

      {/* AMINAH: CreateContent modal */}
      <CreateContent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchContent(user)}
      />

      

      {/* AMINAH: Section title */}
      <h2 className="dashboard-section-title">My Content</h2>

      {error && <div className="error-alert">{error}</div>}

      {loading ? (
        <div className="loading">Loading your content...</div>
      ) : content.length === 0 ? (
        <div className="empty-state">
          <p>No content yet. Create your first piece of content!</p>
        </div>
      ) : (
        <div className="dashboard-content-list">
          {content.map((item) => (
            <div key={item.id} className="dashboard-content-card content-item-box">
              {/* AMINAH: Content item box container */}
              <div className="dashboard-content-header">
                <span className={`dashboard-badge ${getStatusBadgeClass(item.status)}`}>{item.status || "Draft"}</span>
                <span className="dashboard-content-menu">•••</span>
              </div>
              <div className="content-item-title">{item.title}</div>
              <div className="content-item-text">{item.text}</div>
              <div className="content-item-meta">
                <span className="content-item-stage">Stage: {item.stage || "Draft"}</span>
                <span className="content-item-date">{item.createdAt ? formatDate(item.createdAt) : "Invalid Date"}</span>
              </div>
              <div className="dashboard-content-type">{item.type || item.template || item.category || item.name || "Company Announcement"}</div>
              <div className="dashboard-content-actions">
                <button className="icon-btn edit" onClick={(e) => handleEditClick(e, item)} title="Edit">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button className="icon-btn delete" onClick={(e) => handleDeleteClick(e, item.id)} title="Delete">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
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
                    <option value="Ready to Post">Ready to Post</option>
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
    </div>
  );
}