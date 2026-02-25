import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";

const CreateTemplate = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState("");
  const [structure, setStructure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be logged in to create a template.");
      return;
    }

    if (!title.trim() || !sections.trim() || !structure.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const templateRef = await addDoc(collection(db, "templates"), {
        title,
        sections,
        structure,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });
      setSuccess(true);
      onSuccess(templateRef.id);
    } catch (err) {
      console.error("Error creating template:", err);
      setError("Failed to create template. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setSections("");
    setStructure("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Template</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">×</button>
        </div>

        {success ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ marginBottom: 8, color: "#111827" }}>Template Created!</h3>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>
              Your template <strong>{title}</strong> has been saved successfully.
            </p>
            <button className="btn-submit" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-content-form">
            <div className="form-group">
              <label htmlFor="template-title">Title</label>
              <input
                id="template-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter template title"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="template-sections">Sections</label>
              <textarea
                id="template-sections"
                value={sections}
                onChange={(e) => setSections(e.target.value)}
                placeholder="Enter template sections (e.g. Introduction, Body, Conclusion)"
                rows="4"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="template-structure">Structure</label>
              <textarea
                id="template-structure"
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                placeholder="Describe the structure of this template"
                rows="4"
                disabled={loading}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Template"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateTemplate;