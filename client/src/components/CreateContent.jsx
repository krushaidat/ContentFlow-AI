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
import "./styles/createContent.css";

const API_BASE = "http://localhost:5000/api";



const CreateContent = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [stage, setStatus] = useState("Draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
 

  // AI writing assist
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceTimer = useRef(null);
  const textareaRef = useRef(null);

  const auth = getAuth();
  const user = auth.currentUser;




  // Abdalaa: template selection was removed from create content,
// so AI suggestions no longer depend on any selected template here.
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
          templateId: null,
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
  []
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
        // Abdalaa: content is created first.
        // AI guidelines are managed separately and used later in validation.
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });

     

      setTitle("");
      setText("");
      setStatus("Draft");
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



  const handleClose = () => {
    setTitle("");
    setText("");
    setStatus("Draft");
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
              <option value="Ready To Post">Ready To Post</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={handleClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={loading}>{loading ? "Creating..." : "Create Content"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateContent;