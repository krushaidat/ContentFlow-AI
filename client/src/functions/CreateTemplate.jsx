import React, { useEffect, useState } from "react";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";

const CreateTemplate = ({
  isOpen,
  onClose,
  onSuccess,
  existingTemplate = null,
  mode = "create",
  initialTemplate = null,
}) => {
  const templateToEdit = initialTemplate || existingTemplate;
  const isEditMode = mode === "edit" || Boolean(templateToEdit?.id);

  const [title, setTitle] = useState("");
  const [requiredSections, setRequiredSections] = useState("");
  const [structure, setStructure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  /** DRAVEN: Fetch existing template data if editing. If creating, fields are reset to empty. */
  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode && templateToEdit) {
      setTitle(templateToEdit.title || "");
      setRequiredSections(templateToEdit.requiredSections || "");
      setStructure(templateToEdit.structure || templateToEdit.content || "");
    } else {
      setTitle("");
      setRequiredSections("");
      setStructure("");
    }

    setError(null);
    setSuccess(false);
  }, [isOpen, isEditMode, templateToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedSections = requiredSections.trim();
    const trimmedStructure = structure.trim();

    if (!trimmedTitle || !trimmedSections || !trimmedStructure) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: trimmedTitle,
        requiredSections: trimmedSections,
        structure: trimmedStructure,
        content: trimmedStructure,
        icon: "📄",
        lastModified: new Date().toLocaleDateString(),
      };

      if (isEditMode && templateToEdit?.id) {
        await updateDoc(doc(db, "templates", templateToEdit.id), payload);
      } else {
        await addDoc(collection(db, "templates"), payload);
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error("Error saving template:", err);
      setError(
        isEditMode
          ? "Failed to update template. Please try again."
          : "Failed to create template. Please try again."
      );
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
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? "Edit Template" : "Create New Template"}</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">
            ×
          </button>
        </div>

        {success ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ marginBottom: 8, color: "#111827" }}>
              {isEditMode ? "Template Updated!" : "Template Created!"}
            </h3>
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
                style={{ background: "#fff", color: "#000" }}
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
                style={{ background: "#fff", color: "#000" }}
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
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading
                  ? isEditMode
                    ? "Saving..."
                    : "Creating..."
                  : isEditMode
                  ? "Save Changes"
                  : "Create Template"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateTemplate;
