/**
 * Workflow Page
 * Author: Abdalaa & Tanvir
 *
 * This page displays user content grouped by workflow stage.
 * We fetch content from Firestore and filter by:
 *  - logged-in user (createdBy field in Firestore)
 *  - selected stage (stage field in Firestore)
 *
 * UI upgraded with purple accents and a modern layout.
 */

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import "../styles/workflow.css";

// These stages must match exactly what we store in Firestore
const STAGES = [
  "Draft",
  "Planning",
  "Review",
  "Update",
  "Ready-To-Post",
  "Posted",
];

/**
 * Abdalaa: helper for stage badge colors
 */
const stageBadgeClass = (stage) => {
  switch (stage) {
    case "Draft":
      return "badge badge-draft";
    case "Planning":
      return "badge badge-planning";
    case "Review":
      return "badge badge-review";
    case "Update":
      return "badge badge-update";
    case "Ready-To-Post":
      return "badge badge-ready";
    case "Posted":
      return "badge badge-posted";
    default:
      return "badge";
  }
};

const Workflow = () => {
  
  const [selectedStage, setSelectedStage] = useState("Draft");

 
  const [items, setItems] = useState([]);

  // Selected template and content
  const [selectedTemplate, setSelectedTemplate] = useState("New Product");
  const [selectedContent, setSelectedContent] = useState(null);

  // Validation states
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ai state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState(null);

  /**
   * Fetch content from Firestore
   * Author: Tanvir
   * - Queries Firestore for user's content filtered by selected stage
   * - Orders results by creation date (newest first)
   * - Handles authentication check and error handling
   */
  const fetchContent = async () => {
    setLoading(true);
    setError("");

    try {
      const colRef = collection(db, "content");

      const uid = auth.currentUser?.uid;

      if (!uid) {
        setError("User not authenticated.");
        setItems([]);
        return;
      }

      const q = query(
        colRef,
        where("createdBy", "==", uid),
        where("stage", "==", selectedStage),
        limit(50),
      );

      const snapshot = await getDocs(q);

      const results = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setItems(results);
      if (results.length > 0 && !selectedContent) {
        setSelectedContent(results[0]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validate selected content with backend
   * Author: Tanvir
   * - Sends selected content to /api/ai/validate endpoint
   * - Receives Gemini AI analysis (compliance, brandScore, suggestions)
   * - Updates UI with validation results and shows results panel
   */
  const handleValidateContent = async () => {
    if (!selectedContent) {
      alert("Please select content to validate");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/ai/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId: selectedContent.id }),
      });

      const data = await res.json();
      if (data.success) {
        setValidationResult(data.validation);
        setShowValidationPanel(true);
      } else {
        alert("Validation failed: " + data.error);
      }
    } catch (err) {
      console.error("Validation error:", err);
      alert("Error validating content");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch content when stage changes
   */
  useEffect(() => {
    fetchContent();
    setValidationResult(null);
    setShowValidationPanel(false);
  }, [selectedStage]);

  /**
    abdalaa:
   calls the backend endpoint that talks to gemini
   */
  const runAiValidation = async () => {
    if (!selectedItem) return;
  
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
  
    try {
      const payload = {
        title: selectedItem.title,
        text: selectedItem.text,
        stage: selectedItem.status,
      };
  
      const res = await fetch("/api/ai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      //  if there is a error it shows it clearly
      const data = await res.json().catch(() => null);
  
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
  
      setAiResult(data);
    } catch (err) {
      console.error("AI validate frontend error:", err);
      setAiError(err.message || "Could not validate content.");
    } finally {
      setAiLoading(false);
    }
  };
  return (
    <div className="workflow-bg">
      <div className="workflow-page modern">
        {/* Header Section */}
        <div className="wf-header">
          <div>
            <h2 className="modern-title">Workflow</h2>
            <p className="wf-subtitle">
              Manage your content stages and validate with AI
            </p>
          </div>

          {/* Dropdown */}
          <div className="wf-stage-select">
            <span className="wf-label">Currently Viewing</span>

            <div className="select-wrap">
              <select
                className="select"
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              <span className="select-caret">▾</span>
            </div>
          </div>
        </div>

        {/* 2-column layout */}
        <div className="wf-grid">
          {/* LEFT SIDE — Content List */}
          <section className="wf-card">
            <div className="wf-card-header">
              <div className="wf-card-title">
                {selectedStage} Content
                <span className={stageBadgeClass(selectedStage)}>{selectedStage}</span>
              </div>

              <div className="wf-card-meta">
                {loading ? "Loading..." : `${items.length} item(s)`}
              </div>
            </div>

            <div className="wf-card-body">
              {error && <div className="wf-alert wf-alert-error">{error}</div>}
              {error && <div className="wf-alert wf-alert-error">{error}</div>}

              {!loading && !error && items.length === 0 && (
                <div className="wf-empty">
                  <div className="wf-empty-icon">🟣</div>
                  <div className="wf-empty-title">No content found</div>
                  <div className="wf-empty-sub">
                    Switch stages or create content from Dashboard.
                  </div>
                </div>
              )}

              {!loading && !error && items.length > 0 && (
                <ul className="wf-list">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={`wf-item ${selectedContent?.id === item.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedContent(item);
                        setValidationResult(item.validation || null);
                        if (item.validation) {
                          setShowValidationPanel(true);
                        }
                      }}
                    >
                      <div className="wf-item-top">
                        <div className="wf-item-title">{item.title}</div>
                        <span className={stageBadgeClass(item.stage)}>
                          {item.stage}
                        </span>
                      </div>

                      <div className="wf-item-text">{item.text}</div>
                      <div className="wf-item-text">{item.text}</div>

                      <div className="wf-item-footer">
                        <span className="wf-dot" />
                        <span className="wf-muted">
                          Created: {String(item.createdAt).slice(0, 10)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* RIGHT SIDE — AI Validation Panel */}
          <aside className="wf-card validation-panel">
            <div className="wf-card-header">
              <div className="wf-card-title">
                AI Content Validation
                <span className="badge badge-ai">GEMINI</span>
              </div>
            </div>

            <div className="wf-card-body">
              {!showValidationPanel ? (
                <div className="validation-setup">
                  {/* Template Selector */}
                  <div className="validation-section">
                    <label className="validation-label">Select Template</label>
                    <div className="select-wrap">
                      <select
                        className="select validation-select"
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                      >
                        <option value="New Product">New Product</option>
                        <option value="Product Update">Product Update</option>
                        <option value="Marketing Campaign">Marketing Campaign</option>
                        <option value="Blog Post">Blog Post</option>
                      </select>
                      <span className="select-caret">▾</span>
                    </div>
                  </div>

                  {/* Validate Button */}
                  <button
                    className="validate-btn"
                    onClick={handleValidateContent}
                    disabled={!selectedContent || loading}
                  >
                    {loading ? "Validating..." : "Validate Content"}
                  </button>

                  {/* Info Message */}
                  <div className="validation-info">
                    <p><strong>Select a template</strong> to validate your content against.</p>
                    <p><strong>Click "Validate Content"</strong> to start the AI analysis.</p>
                  </div>
                </div>
              ) : validationResult ? (
                <div className="validation-results">
                  {/* Content & Template Info */}
                  <div className="result-header">
                    <div className="result-info">
                      <div className="result-content-title">{selectedContent?.title}</div>
                      <div className="result-template">
                        Template: <strong>{selectedTemplate}</strong>
                      </div>
                      <div className="result-timestamp">
                        Last Validated: {new Date(validationResult.validatedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      className="btn-back"
                      onClick={() => {
                        setShowValidationPanel(false);
                        setValidationResult(null);
                      }}
                    >
                      ← Back
                    </button>
                  </div>

                  {/* Review Status */}
                  <div className="review-status">
                    <div className="status-badge">
                      {validationResult.compliance ? (
                        <span className="status-badge valid">
                          ✓ Review: Content Valid
                        </span>
                      ) : (
                        <span className="status-badge invalid">
                          ⚠ Review: Needs Fixes
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Brand Consistency Score */}
                  <div className="score-section">
                    <div className="score-label">Brand Consistency</div>
                    <div className="score-display">
                      <div className="score-number">{validationResult.brandScore}</div>
                      <div className="score-max">/100</div>
                      <div className="score-circle">
                        <svg viewBox="0 0 120 120">
                          <circle
                            cx="60"
                            cy="60"
                            r="54"
                            fill="none"
                            stroke="#e5e5e5"
                            strokeWidth="8"
                          />
                          <circle
                            cx="60"
                            cy="60"
                            r="54"
                            fill="none"
                            stroke="#7c3aed"
                            strokeWidth="8"
                            strokeDasharray={`${(validationResult.brandScore / 100) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                            transform="rotate(-90 60 60)"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Suggestions/Fixes */}
                  <div className="suggestions-section">
                    <div className="suggestions-title">AI Suggestions / Fixes</div>
                    <div className="suggestions-list">
                      {validationResult.suggestions && validationResult.suggestions.length > 0 ? (
                        validationResult.suggestions.map((suggestion, idx) => (
                          <div key={idx} className="suggestion-item">
                            <span className="suggestion-icon">●</span>
                            <span className="suggestion-text">{suggestion}</span>
                          </div>
                        ))
                      ) : (
                        <div className="suggestion-item">
                          <span className="suggestion-icon">✓</span>
                          <span className="suggestion-text">No suggestions - content looks great!</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Apply Fixes Button */}
                  <button className="apply-fixes-btn">Apply Fixes</button>

                  {/* Validation Indicators */}
                  <div className="validation-indicators">
                    <div className="indicator valid">
                      <span className="indicator-dot valid">●</span>
                      Valid
                    </div>
                    <div className={`indicator ${validationResult.suggestions.length > 0 ? "active" : ""}`}>
                      <span className={`indicator-dot ${validationResult.suggestions.length > 0 ? "warning" : ""}`}>●</span>
                      Improvements
                    </div>
                    <div className={`indicator ${!validationResult.compliance ? "active" : ""}`}>
                      <span className={`indicator-dot ${!validationResult.compliance ? "error" : ""}`}>●</span>
                      Required Fixes
                    </div>
                  </div>
                </div>
              ) : (
                <div className="wf-empty">
                  <div className="wf-empty-icon">🔍</div>
                  <div className="wf-empty-title">No validation yet</div>
                  <div className="wf-empty-sub">
                    Click "Validate Content" to analyze your content
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        <p className="workflow-note modern-note">
          AI validation powered by Gemini API • Results saved to Firebase
        </p>
      </div>
    </div>
  );
};

export default Workflow;
