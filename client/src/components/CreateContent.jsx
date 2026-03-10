import React, { useEffect, useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { fetchTemplates, incrementTemplateUsage } from "../functions/templateDB";
import TemplateIcon from "./TemplateIcon";
import "./styles/createContent.css";

// Aminah:
// This component is used in the Dashboard.jsx file to create new content items. 
// It includes a form with fields for title, text, and status, as well as a template selection feature that allows users to quickly populate the form with predefined structures for common content types.
const CreateContent = ({ isOpen, onClose, onSuccess }) => {
  const CONTENT_TEMPLATES = [
    {
      id: "company-announcement",
      name: "Company Announcement",
      icon: "📢",
      iconType: "emoji",
      title: "Company Announcement: ",
      text: "Share company news and updates:\n\n• Key announcement:\n• Why it matters:\n• Call to action:",
      description: "Structure for announcing company news",
      modified: "Feb 5, 2026",
    },
    {
      id: "new-product-launch",
      name: "New Product",
      icon: "🛒",
      iconType: "emoji",
      title: "The Product: ",
      text: "Introduce your new product:\n\n• Key features:\n• Who will benefit:\n• Launch date & availability:",
      description: "Structure for detailing new product launches",
      modified: "Feb 4, 2026",
    },
    {
      id: "Product Update",
      name: "Event Promotion",
      icon: "🎫",
      iconType: "emoji",
      title: "Join Us: ",
      text: " Event details\n\n• Date:\n• Time:\n• What you’ll learn:\n• Register link:",
      description: "Structure for promoting upcoming webinars, workshops, or events",
      modified: "Feb 3, 2026",
    },
    {
      id: "Newsletter",
      name: "Weekly Newsletter",
      icon: "📰",
      iconType: "emoji",
      title: "Weekly Newsletter: ",
      text: "Outline for curating weekly newsletter content:\n\n• Top story:\n• Highlights:\n• Links & CTAs:",
      description: "Outline for curating weekly newsletter content",
      modified: "Feb 2, 2026",
    },
  ];

  // AMINAH:
  // State variables for form fields, template selection, loading state, and error handling
  
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [stage, setStatus] = useState("Draft");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templateSearch, setTemplateSearch] = useState(""); // AMINAH: State for template search
  const [savedTemplates, setSavedTemplates] = useState([]);
  const auth = getAuth();
  const user = auth.currentUser;

  // AMINAH: When the form is submitted, we validate the input and then send a request to the backend to create a new content item in Firestore. 
  // The prompt for Gemini includes the title, stage, and text of the content, which can be used for validation or enhancement on the backend. 
  // We also handle loading state and errors to provide feedback to the user.
  const allTemplates = [
  ...savedTemplates,
  ...CONTENT_TEMPLATES
  ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  const filteredTemplates = allTemplates.filter((t) =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.description.toLowerCase().includes(templateSearch.toLowerCase())
  );

  // AMINAH: Compute the name of the selected template to display in the UI
  const selectedTemplateName = allTemplates.find((t) => t.id === selectedTemplate)?.name;

  useEffect(() => {
    if (!isOpen) return;

// AMINAH: Load saved templates from Firestore when the modal is opened, and combine them with the predefined templates. 
// This allows users to manage their own custom templates in addition to the common structures we provide.
    const loadSavedTemplates = async () => {
      try {
        const templates = await fetchTemplates();
        const mappedTemplates = templates.map((template) => ({
          id: template.id,
          name: template.title || "Untitled Template",
          icon: template.icon || "📄",
          iconType: template.iconType || "emoji",
          title: template.title ? `${template.title}: ` : "",
          text: template.content || "",
          description: template.content || "Saved custom template",
          modified: "Saved template",
        }));
        setSavedTemplates(mappedTemplates);
      } catch (fetchError) {
        console.error("Failed to load saved templates:", fetchError);
      }
    };

    loadSavedTemplates();
  }, [isOpen]);

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
        stage,
        templateId: selectedTemplate || "new-product-launch",
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });



      // Aminah: If the created content used a saved template, increment its usage count
      if (selectedTemplate) {
        // check if selectedTemplate corresponds to a saved template id (fetched from Firestore)
        const isSaved = savedTemplates.some((t) => t.id === selectedTemplate);
        if (isSaved) {
          try {
            await incrementTemplateUsage(selectedTemplate);
          } catch (incErr) {
            console.warn('Failed to increment template usage:', incErr);
          }
        }
      }


      setTitle("");
      setText("");
      setStatus("draft");
      setSelectedTemplate("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error adding content:", err);
      setError("Failed to create content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // AMINAH:
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

    const template = allTemplates.find((t) => t.id === templateId);
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
                {/* AMINAH: Show the name of the selected template or indicate that it's blank content */}
                {selectedTemplateName ? `Selected: ${selectedTemplateName}` : "Blank Content"}
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
            <label htmlFor="stage">Stage</label>
            <select
              id="stage"
              value={stage}
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
              <div className="modal-header templates-header">
                <div className="templates-header-left">
                  <span className="templates-header-icon">📄</span>
                  <h2>Templates</h2>
                  <span className="templates-header-desc">Manage and modify templates to ensure brand consistency.</span>
                </div>
                <button className="modal-close" onClick={() => setShowTemplates(false)}>×</button>
              </div>
              <div className="templates-search-row">
                 {/* AMINAH: Search input for filtering templates */}
                <input
                  className="templates-search"
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                />
              </div>
              <div className="templates-grid">
                 {/* AMINAH: Show only filtered templates, or a message if none found */}
                {filteredTemplates.length === 0 ? (
                  <div style={{ padding: 24, color: '#6b7280', fontSize: 16 }}>No templates found.</div>
                ) : (
                  filteredTemplates.map((t) => (
                    <div key={t.id} className="template-card">
                      <div className="template-card-icon">
                        <TemplateIcon
                          icon={t.icon}
                          iconType={t.iconType}
                          label="Template icon"
                          size={30}
                        />
                      </div>
                      <div className="template-card-body">
                        <div className="template-card-title">{t.name}</div>
                        <div className="template-card-desc">{t.description}</div>
                        <div className="template-card-meta">Last modified {t.modified}</div>
                      </div>
                      <div className="template-card-actions">
                        <button className="btn-template-select" onClick={() => { setShowTemplates(false); handleTemplateSelect(t.id); }}>Select</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateContent;
