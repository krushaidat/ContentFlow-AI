import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import "./styles/createContent.css";

// This component is used in the Dashboard.jsx file to create new content items. 
const CreateContent = ({ isOpen, onClose, onSuccess }) => {
  const CONTENT_TEMPLATES = [
    {
      id: "Company Announcement",
      name: "Company Announcement",
      title: "Company Announcement: ",
      text: "Share company news and updates:\n\n• Key announcement:\n• Why it matters:\n• Call to action:",
      description: "Structure for announcing company news",
      modified: "Feb 5, 2026",
    },
    {
      id: "Product Launch",
      name: "New Product",
      title: "The Product: ",
      text: "Introduce your new product:\n\n• Key features:\n• Who will benefit:\n• Launch date & availability:",
      description: "Structure for detailing new product launches",
      modified: "Feb 4, 2026",
    },
    {
      id: "Product Update",
      name: "Event Promotion",
      title: "Join Us: ",
      text: " Event details\n\n• Date:\n• Time:\n• What you’ll learn:\n• Register link:",
      description: "Structure for promoting upcoming webinars, workshops, or events",
      modified: "Feb 3, 2026",
    },
    {
      id: "Newsletter",
      name: "Weekly Newsletter",
      title: "Weekly Newsletter: ",
      text: "Outline for curating weekly newsletter content:\n\n• Top story:\n• Highlights:\n• Links & CTAs:",
      description: "Outline for curating weekly newsletter content",
      modified: "Feb 2, 2026",
    },
  ];
  
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Draft");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if(!user) {
      setError("You must be logged in to create content.");
      return;
    }

    if (!title.trim() || !text.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "content"), {
        title: title.trim(),
        text: text.trim(),
        status,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });

      setTitle("");
      setText("");
      setStatus("draft");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error adding content:", err);
      setError("Failed to create content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle template selection and populate the form fields based on the selected template
  const handleTemplateSelect = (templateId) => {
    if (templateId === "") {
      // Blank content - clear the fields
      setSelectedTemplate("");
      setTitle("");
      setShowTemplates(false);
      setText("");
      return;
    }

    const template = CONTENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    setTitle(template.title);
    setText(template.text);
    setShowTemplates(false);
  };

  // Handle closing the modal and resetting the form
  const handleClose = () => {
    // Reset form to blank state
    setTitle("");
    setText("");
    setStatus("Draft");
    setSelectedTemplate("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  // AMINAH: added template selection UI and integrated it with the form fields to allow users to quickly populate content based on common structures. 
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Content</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="create-content-form">
          <div className="form-group">
            <label>Start from a Template</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="btn-submit"
                onClick={() => setShowTemplates(true)}
                disabled={loading}
                style={{ padding: "8px 12px", fontSize: 14 }}
              >
                Select Template
              </button>
              <div style={{ fontSize: 14, color: "#374151" }}>
                {selectedTemplate ? `Selected: ${selectedTemplate}` : "Blank Content"}
              </div>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter content title"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="text">Content</label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your content here"
              rows="8"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={loading}
            >
              <option value="Draft">Draft</option>
              <option value="Planning">Planning</option>
              <option value="Review">Review</option>
              <option value="Update">Update</option>
              <option value="Ready to Post">Ready to Post</option>
            </select>
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
              {loading ? "Creating..." : "Create Content"}
            </button>
          </div>
        </form>

        {showTemplates && (
          <div className="templates-overlay" onClick={() => setShowTemplates(false)}>
            <div className="templates-panel" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Templates</h2>
                <button className="modal-close" onClick={() => setShowTemplates(false)}>×</button>
              </div>
              <div style={{ padding: 20 }}>
                <input
                  placeholder="Search templates..."
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 16 }}
                />

                <div className="templates-grid">
                  {CONTENT_TEMPLATES.map((t) => (
                    <div key={t.id} className="template-card" onClick={() => handleTemplateSelect(t.id)}>
                      <div className="template-icon">📄</div>
                      <div className="template-body">
                        <div className="template-title">{t.name}</div>
                        <div className="template-desc">{t.description}</div>
                        <div className="template-meta">Last modified {t.modified}</div>
                      </div>
                      <div className="template-actions">
                        <button className="btn-cancel" onClick={(e) => { e.stopPropagation(); setShowTemplates(false); handleTemplateSelect(t.id); }}>Use</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateContent;
