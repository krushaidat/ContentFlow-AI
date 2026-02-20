/**
 * Workflow Page
 * Author: Abdalaa
 *
 * This page displays user content grouped by workflow stage.
 * We fetch content from Firestore and filter by:
 *  - logged-in user (userId)
 *  - selected stage (status field in Firestore)
 *
 * UI upgraded with purple accents and a modern layout.
 */

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../../firebase";
import "../styles/workflow.css";

// These stages must match exactly what we store in Firestore
const STAGES = ["Draft", "Planning", "Review", "Update", "Ready-To-Post", "Posted"];

/**
 * Small helper to assign badge colors based on stage.
 * Makes the UI feel more dynamic instead of flat.
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
  // Stage selected in dropdown
  const [selectedStage, setSelectedStage] = useState("Draft");

  // Content returned from Firestore
  const [items, setItems] = useState([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Whenever selectedStage changes,
   * fetch content from Firestore again.
   */
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError("");

      try {
        // Collection name confirmed from Firebase console
        const colRef = collection(db, "content");

        // Get currently logged in user
        const uid = auth.currentUser?.uid;

        // Safety check — if uid missing something is wrong with auth
        if (!uid) {
          setError("User not authenticated.");
          setItems([]);
          setLoading(false);
          return;
        }

      
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

  return (
    <div className="workflow-bg">
      <div className="workflow-page modern">

        {/* Header Section */}
        <div className="wf-header">
          <div>
            <h2 className="modern-title">Workflow</h2>
            <p className="wf-subtitle">
              Manage your content stages in a clean, purple interface ✨
            </p>
          </div>

          {/* Custom styled dropdown */}
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

        {/* Two-column layout */}
        <div className="wf-grid">

          {/* LEFT SIDE — Content List */}
          <section className="wf-card">
            <div className="wf-card-header">
              <div className="wf-card-title">
                {selectedStage} Content
                <span className={stageBadgeClass(selectedStage)}>
                  {selectedStage}
                </span>
              </div>

              <div className="wf-card-meta">
                {loading ? "Loading..." : `${items.length} item(s)`}
              </div>
            </div>

            <div className="wf-card-body">

              {error && (
                <div className="wf-alert wf-alert-error">
                  {error}
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="wf-empty">
                  <div className="wf-empty-icon">🟣</div>
                  <div className="wf-empty-title">No content found</div>
                  <div className="wf-empty-sub">
                    Try switching stages or create new content from Dashboard.
                  </div>
                </div>
              )}

              {!loading && !error && items.length > 0 && (
                <ul className="wf-list">
                  {items.map((item) => (
                    <li key={item.id} className="wf-item">
                      <div className="wf-item-top">
                        <div className="wf-item-title">
                          {item.title}
                        </div>
                        <span className={stageBadgeClass(item.status)}>
                          {item.status}
                        </span>
                      </div>

                      <div className="wf-item-text">
                        {item.text}
                      </div>

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

          {/* RIGHT SIDE — AI Placeholder */}
          <aside className="wf-card">
            <div className="wf-card-header">
              <div className="wf-card-title">
                AI Validation
                <span className="badge badge-ai">GEMINI</span>
              </div>
              <div className="wf-card-meta">Pending</div>
            </div>

            <div className="wf-card-body">
              <p>
                This panel will display Gemini AI feedback and validation.
              </p>
            </div>
          </aside>
        </div>

        <p className="workflow-note modern-note">
          Automation will be powered by Gemini API integrations per stage.
        </p>

      </div>
    </div>
  );
};

export default Workflow;