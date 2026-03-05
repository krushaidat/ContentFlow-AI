import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { addTemplate } from "../functions/templateDB";

const CreateTemplate = ({ isOpen, onClose, onSuccess, existingTemplate }) => {
  const [title, setTitle] = useState(existingTemplate?.title || "");
  const [requiredSections, setRequiredSections] = useState(existingTemplate?.requiredSections || "");
  const [structure, setStructure] = useState(existingTemplate?.structure || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;

  /** DRAVEN: Fetch existing template data if editing. If creating fields are null*/
  useEffect(() => {
    if (existingTemplate) {
      setTitle(existingTemplate.title || "");
      setRequiredSections(existingTemplate.requiredSections || "");
      setStructure(existingTemplate.structure || "");
    } else {
      setTitle("");
      setRequiredSections("");
      setStructure("");
    }
  }, [existingTemplate]);

  /**DRAVEN: Handle form submission for creating or updating a template */
  const handleSubmit = async (e) => {
  e.preventDefault();
  setError(null);

  if (!title.trim() || !structure.trim()) {
    setError("Please fill in all fields.");
    return;
  }

    if (!title.trim() || !requiredSections.trim() || !structure.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
    if (existingTemplate) {
      await updateDoc(doc(db, "templates", existingTemplate.id), {
        title,
        requiredSections,
        structure,
        lastModified: new Date().toLocaleDateString(),
      });
    } else {
      await addDoc(collection(db, "templates"), {
        title,
        requiredSections,
        structure,
        lastModified: new Date().toLocaleDateString(),
        createdBy: auth.currentUser.uid,
      });
    }
    onSuccess();
  } catch (error) {
    console.error("Error saving template:", error);
  }
};

  } catch (err) {
    console.error("Error creating template:", err);
    setError("Failed to create template. Please try again.");
  } finally {
    setLoading(false);
  }
};
  const handleClose = () => {
    setTitle("");
    setRequiredSections("");
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
            <h3 style={{ marginBottom: 8, color: "#111827" }}>{existingTemplate ? "Template Updated!" : "Template Created!"}</h3>
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
                value={requiredSections}
                onChange={(e) => setRequiredSections(e.target.value)}
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
                {loading ? (existingTemplate ? "Saving..." : "Creating...") 
                : (existingTemplate ? "Save Changes" : "Create Template")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateTemplate;