import React, { useEffect, useState } from "react";
import { addTemplate, updateTemplate } from "../functions/templateDB";

const CreateTemplate = ({
  isOpen,
  onClose,
  onSuccess,
  mode = "create",
  initialTemplate = null,
}) => {
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState("");
  const [structure, setStructure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const isEditMode = mode === "edit" && Boolean(initialTemplate?.id);

  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode) {
      setTitle(initialTemplate?.title || "");
      setSections(initialTemplate?.sections || "");
      setStructure(initialTemplate?.content || "");
    } else {
      setTitle("");
      setSections("");
      setStructure("");
    }

    setError(null);
    setSuccess(false);
  }, [isOpen, isEditMode, initialTemplate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !structure.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      let savedId;

      if (isEditMode) {
        await updateTemplate(initialTemplate.id, title, structure);
        savedId = initialTemplate.id;
      } else {
        savedId = await addTemplate(title, structure);
      }

      setSuccess(true);

      if (onSuccess) {
        onSuccess(savedId);
      }
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
          <h2>{isEditMode ? "Edit Template" : "Create New Template"}</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">×</button>
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
                {loading ? "Saving..." : isEditMode ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateTemplate;