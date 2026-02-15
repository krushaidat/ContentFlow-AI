import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import "./styles/createContent.css";

// This component is used in the Dashboard.jsx file to create new content items. 
const CreateContent = ({ isOpen, onClose, onSuccess }) => {
  const CONTENT_TEMPLATES = [
    // It includes a modal form with fields for title, text, and status, as well as a dropdown to select from predefined content templates.
    {

      id: "Company Announcement",
      name: "Company Announcement",
      title: "Company Announcement: ",
      text: "Share company news and updates:\n\n• Key announcement:\n• Why it matters:\n• Call to action:",
    },
    {
      id: "Product Launch",
      name: "New Product",
      title: "The Product: ",
      text: "Introduce your new product:\n\n• Key features:\n• Who will benefit:\n• Launch date & availability:",
    },
    {
      id: "Product Update",
      name: "Product Update",
      title: "The ProductUpdate: ",
      text: " What’s new?\n\n• Feature update:\n• Who it helps:\n• How to get started:",
    },
    {
      id: "Events",
      name: "Event Promotion",
      title: "Join Us: ",
      text: " Event details\n\n• Date:\n• Time:\n• What you’ll learn:\n• Register link:",
    },
  ];
  
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Draft");
  const [selectedTemplate, setSelectedTemplate] = useState("");
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
      setText("");
      return;
    }

    const template = CONTENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    setTitle(template.title);
    setText(template.text);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Content</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="create-content-form">
          <div className="form-group">
            <label htmlFor="template">Start from a Template</label>
            <select
              id="template"
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              disabled={loading}
            >
              <option value="">Blank Content</option>
              {CONTENT_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
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
      </div>
    </div>
  );
};

export default CreateContent;
