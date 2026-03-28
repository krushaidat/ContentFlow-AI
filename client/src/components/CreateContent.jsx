/**
 * CreateContent Modal
 * Authors: Aminah (original), Tanvir (AI writing assist)
 *
 * Modal for creating new content items with template selection
 * and an AI writing assistant that suggests continuations as you type.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { fetchTemplates, incrementTemplateUsage } from "../functions/templateDB";
import "./styles/createContent.css";

const API_BASE = "http://localhost:5000/api";

const CONTENT_TEMPLATES = [
  {
    id: "company-announcement",
    name: "Company Announcement",
    title: "Company Announcement: ",
    text: "Share company news and updates:\n\n• Key announcement:\n• Why it matters:\n• Call to action:",
    description: "Structure for announcing company news",
    modified: "Feb 5, 2026",
  },
  {
    id: "new-product-launch",
    name: "New Product",
    title: "The Product: ",
    text: "Introduce your new product:\n\n• Key features:\n• Who will benefit:\n• Launch date & availability:",
    description: "Structure for detailing new product launches",
    modified: "Feb 4, 2026",
  },
  {
    id: "Product Update",
    name: "Product Update",
    title: "Product Update: ",
    text: "Notify users about the latest product improvements:\n\n• What's new:\n• Benefits:\n• How to access:",
    description: "Structure for communicating product updates",
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

const CreateContent = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [stage, setStatus] = useState("Draft");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [savedTemplates, setSavedTemplates] = useState([]);

  // AI writing assist
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceTimer = useRef(null);
  const textareaRef = useRef(null);

  const auth = getAuth();
  const user = auth.currentUser;

  const allTemplates = [
    ...savedTemplates,
    ...CONTENT_TEMPLATES,
  ].filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);

  const filteredTemplates = allTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const selectedTemplateName = allTemplates.find((t) => t.id === selectedTemplate)?.name;

  useEffect(() => {
    if (!isOpen) return;
    const loadSavedTemplates = async () => {
      try {
        const templates = await fetchTemplates();
        setSavedTemplates(
          templates.map((t) => ({
            id: t.id,
            name: t.title || "Untitled Template",
            title: t.title ? `${t.title}: ` : "",
            text: t.content || "",
            description: t.content || "Saved custom template",
            modified: "Saved template",
          }))
        );
      } catch (err) {
        console.error("Failed to load saved templates:", err);
      }
    };
    loadSavedTemplates();
  }, [isOpen]);

  // AI writing assist — debounced
  const requestAiSuggestions = useCallback(
    async (currentText) => {
      if (!currentText || currentText.trim().length < 15) {
        setAiSuggestions([]);
        setShowAiPanel(false);
        return;
      }

      setAiLoading(true);
      try {
        const res = await fetch(`${API_BASE}/ai/writing-assist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentText,
            templateId: selectedTemplate || null,
          }),
        });
        const data = await res.json();
        if (data.success && data.suggestions?.length > 0) {
          setAiSuggestions(data.suggestions);
          setShowAiPanel(true);
        } else {
          setAiSuggestions([]);
          setShowAiPanel(false);
        }
      } catch {
        setAiSuggestions([]);
        setShowAiPanel(false);
      } finally {
        setAiLoading(false);
      }
    },
    [selectedTemplate]
  );

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => requestAiSuggestions(newText), 2000);
  };

  const handleAcceptSuggestion = (suggestionText) => {
    const separator = text.endsWith("\n") || text.endsWith(" ") ? "" : " ";
    setText((prev) => prev + separator + suggestionText);
    setShowAiPanel(false);
    setAiSuggestions([]);
    textareaRef.current?.focus();
  };

  const handleRequestAssist = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestAiSuggestions(text);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!user) { setError("You must be logged in to create content."); return; }
    if (!title.trim() || !text.trim()) { setError("Please fill in all fields"); return; }

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

      if (selectedTemplate) {
        const isSaved = savedTemplates.some((t) => t.id === selectedTemplate);
        if (isSaved) {
          try { await incrementTemplateUsage(selectedTemplate); } catch {}
        }
      }

      setTitle(""); setText(""); setStatus("Draft"); setSelectedTemplate("");
      setAiSuggestions([]); setShowAiPanel(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error adding content:", err);
      setError("Failed to create content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateId) => {
    if (!templateId) { setSelectedTemplate(""); setTitle(""); setText(""); setShowTemplates(false); return; }
    const template = allTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);
    setTitle(template.title);
    setText(template.text);
    setShowTemplates(false);
    setAiSuggestions([]); setShowAiPanel(false);
  };

  const handleClose = () => {
    setTitle(""); setText(""); setStatus("Draft"); setSelectedTemplate("");
    setError(null); setAiSuggestions([]); setShowAiPanel(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
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
            <label>Start from a Template</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn-submit" onClick={() => setShowTemplates(true)} disabled={loading} style={{ padding: "8px 12px", fontSize: 14 }}>
                Select Template
              </button>
              <div style={{ fontSize: 14, color: "#374151" }}>
                {selectedTemplateName ? `Selected: ${selectedTemplateName}` : "Blank Content"}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter content title" disabled={loading} />
          </div>

          <div className="form-group content-group">
            <div className="content-label-row">
              <label htmlFor="text">Content</label>
              <button type="button" className="ai-assist-trigger" onClick={handleRequestAssist} disabled={aiLoading || !text.trim()} title="Get AI writing suggestions">
                {aiLoading ? <span className="ai-assist-loading">⟳</span> : "AI Suggest"}
              </button>
            </div>
            <textarea ref={textareaRef} id="text" value={text} onChange={handleTextChange} placeholder="Start writing your content… AI will suggest continuations as you type." rows="8" disabled={loading} />

            {showAiPanel && aiSuggestions.length > 0 && (
              <div className="ai-suggestions-panel">
                <div className="ai-suggestions-header">
                  <span className="ai-suggestions-label">AI Suggestions</span>
                  <button type="button" className="ai-suggestions-close" onClick={() => setShowAiPanel(false)}>×</button>
                </div>
                <div className="ai-suggestions-list">
                  {aiSuggestions.map((s, idx) => (
                    <button key={idx} type="button" className="ai-suggestion-option" onClick={() => handleAcceptSuggestion(s.text)}>
                      <span className="ai-suggestion-label">{s.label}</span>
                      <span className="ai-suggestion-preview">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="stage">Stage</label>
            <select id="stage" value={stage} onChange={(e) => setStatus(e.target.value)} disabled={loading}>
              <option value="Draft">Draft</option>
              <option value="Planning">Planning</option>
              <option value="Review">Review</option>
              <option value="Update">Update</option>
              <option value="Ready to Post">Ready to Post</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={handleClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={loading}>{loading ? "Creating..." : "Create Content"}</button>
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
                <input className="templates-search" placeholder="Search templates..." value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
              </div>
              <div className="templates-grid">
                {filteredTemplates.length === 0 ? (
                  <div style={{ padding: 24, color: "#6b7280", fontSize: 16 }}>No templates found.</div>
                ) : (
                  filteredTemplates.map((t) => (
                    <div key={t.id} className="template-card">
                      <div className="template-card-icon">
                        {t.id === "company-announcement" ? "📢" : t.id === "new-product-launch" ? "🛒" : t.id === "Product Update" ? "🎫" : "📄"}
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