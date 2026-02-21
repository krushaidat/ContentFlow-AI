/**
 * Workflow Page
 * Author: Abdalaa

 */

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../../firebase";
import "../styles/workflow.css";


const STAGES = ["Draft", "Planning", "Review", "Update", "Ready-To-Post", "Posted"];

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


  const [selectedItem, setSelectedItem] = useState(null);

 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ai state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState(null);

  /**
   * Abdalaa:
   * Whenever the stage changes, we get the firestore
   */
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError("");

      // this resets the ai page when you refresh
      setSelectedItem(null);
      setAiResult(null);
      setAiError("");

      try {
        const uid = auth.currentUser?.uid;

        if (!uid) {
          setError("User not authenticated.");
          setItems([]);
          return;
        }

        const colRef = collection(db, "content");

        const q = query(
          colRef,
          where("userId", "==", uid),
          where("status", "==", selectedStage),
          orderBy("createdAt", "desc"),
          limit(50)
        );

        const snapshot = await getDocs(q);

        const results = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setItems(results);
      } catch (err) {
        console.error("Workflow fetch error:", err);
        setError(err.message || "Something went wrong loading content.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
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
        {/* Header */}
        <div className="wf-header">
          <div>
            <h2 className="modern-title">Workflow</h2>
            <p className="wf-subtitle">
              Manage your content stages with a clean purple workflow ✨
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
          {/* LEFT — Content list */}
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
                      className={`wf-item ${
                        selectedItem?.id === item.id ? "wf-item-active" : ""
                      }`}
                      onClick={() => {
                        setSelectedItem(item);
                        setAiResult(null);
                        setAiError("");
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="wf-item-top">
                        <div className="wf-item-title">{item.title}</div>
                        <span className={stageBadgeClass(item.status)}>{item.status}</span>
                      </div>

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

          {/* RIGHT — AI Validation */}
          <aside className="wf-card">
            <div className="wf-card-header">
              <div className="wf-card-title">
                AI Validation
                <span className="badge badge-ai">GEMINI</span>
              </div>
              <div className="wf-card-meta">{aiLoading ? "Working..." : "Ready"}</div>
            </div>

            <div className="wf-card-body">
              {!selectedItem && (
                <div className="wf-empty">
                  <div className="wf-empty-icon">🤖</div>
                  <div className="wf-empty-title">Select an item first</div>
                  <div className="wf-empty-sub">
                    Click a content card on the left, then run validation.
                  </div>
                </div>
              )}

              {selectedItem && (
                <>
                  <div className="ai-selected">
                    <div className="ai-selected-title">{selectedItem.title}</div>
                    <div className="ai-selected-sub">{selectedItem.status}</div>
                  </div>

                  <button className="ai-btn" onClick={runAiValidation} disabled={aiLoading}>
                    {aiLoading ? "Validating..." : "Run AI Validation"}
                  </button>

                  {aiError && <div className="wf-alert wf-alert-error">{aiError}</div>}

                  {aiResult && (
                    <div className="ai-result">
                      <div className="ai-score">
                        Brand Score: <strong>{aiResult.brandScore ?? "N/A"}</strong>
                      </div>

                      {aiResult.summary && <p className="ai-summary">{aiResult.summary}</p>}

                      {Array.isArray(aiResult.issues) && aiResult.issues.length > 0 && (
                        <>
                          <h4 className="ai-h">Issues</h4>
                          <ul className="ai-list">
                            {aiResult.issues.map((x, i) => (
                              <li key={i}>
                                <strong>{x.type}:</strong> {x.message}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {Array.isArray(aiResult.suggestions) && aiResult.suggestions.length > 0 && (
                        <>
                          <h4 className="ai-h">Suggestions</h4>
                          <ul className="ai-list">
                            {aiResult.suggestions.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </>
                      )}

                      {/* Debug only */}
                      {aiResult.raw && (
                        <details style={{ marginTop: 10 }}>
                          <summary>Raw Gemini output (debug)</summary>
                          <pre style={{ whiteSpace: "pre-wrap" }}>{aiResult.raw}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        <p className="workflow-note modern-note">
          AI will be powered by Gemini through the backend endpoint.
        </p>
      </div>
    </div>
  );
};

export default Workflow;