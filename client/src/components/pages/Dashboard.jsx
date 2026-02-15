import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import CreateContent from "../CreateContent";
import "../styles/dashboard.css";

export default function Dashboard() {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState({ title: "", text: "", status: "Draft" });

  const auth = getAuth();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        fetchContent();
      } else {
        setLoading(false);
        setError("Please sign in to view your content");
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchContent = async (user) => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      setError("User not authenticated");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const q = query(collection(db, "content"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
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
   * based on the content's current status (draft, planning, review, etc.)
   * This function maps each status to its corresponding color scheme
   */
  const getStatusBadgeClass = (status) => {
    const statusMap = {
      draft: "badge-draft",
      planning: "badge-planning",
      review: "badge-review",
      update: "badge-update",
      "ready-to-post": "badge-ready",
    };
    return statusMap[status?.toLowerCase()] || "badge-draft";
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
      status: item.status,
    });
  };

  /**
   * Handles when the user clicks the delete icon on a content card
   - Stops the click from bubbling up
   - Shows a confirmation dialog to prevent accidental deletion
   - If confirmed, deletes the content from Firestore database
   - Refreshes the content list after successful deletion
   * @param {Event} e - The click event
   * @param {string} contentId - The ID of the content to delete
   */
  const handleDeleteClick = async (e, contentId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this content?")) {
      try {
        await deleteDoc(doc(db, "content", contentId));
        fetchContent(user);
      } catch (error) {
        console.error("Error deleting content:", error);
        setError("Failed to delete content");
      }
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
        status: editingContent.status,
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
    setEditingContent({ title: "", text: "", status: "Draft" });
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

  //(Tanvir- merge fix): Removed duplicate handleSaveChanges, handleDeleteContent, and undefined state references
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>My Content</h2>
        <button
          className="btn-create"
          onClick={() => setIsModalOpen(true)}
        >
          + Create Content
        </button>
      </div>

      <CreateContent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchContent(user)}
      />

      {error && <div className="error-alert">{error}</div>}

      {loading ? (
        <div className="loading">Loading your content...</div>
      ) : content.length === 0 ? (
        <div className="empty-state">
          <p>No content yet. Create your first piece of content!</p>
        </div>
      ) : (
        <div className="content-grid">
          {content.map((item) => (
            <div key={item.id} className="content-card">
              <div className="card-header">
                <h3 className="card-title">{item.title || "Untitled"}</h3>
                <div className="card-actions">
                  <button
                    className="icon-btn edit"
                    onClick={(e) => handleEditClick(e, item)}
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    className="icon-btn delete"
                    onClick={(e) => handleDeleteClick(e, item.id)}
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                {item.status || "Draft"}
              </span>
              
              <p className="card-text">
                {(item.text || "").substring(0, 150)}
                {item.text?.length > 150 ? "..." : ""}
              </p>
              
              <div className="card-footer">
                <span className="card-date">
                  {item.createdAt ? formatDate(item.createdAt) : "Invalid Date"}
                </span>
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
                  <label htmlFor="edit-status">Status</label>
                  <select
                    id="edit-status"
                    value={editingContent.status}
                    onChange={(e) => setEditingContent({ ...editingContent, status: e.target.value })}
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
    </div>
  );
}