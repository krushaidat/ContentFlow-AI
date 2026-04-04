/**
 * Workflow Page
 * Authors: Abdalaa, Tanvir (refactored)
 *
 * Displays user content grouped by workflow stage.
 * Right panel provides AI-powered validation against dynamically-loaded
 * Firestore templates and an "Apply Fixes" feature that rewrites content
 * to satisfy the selected guideline, then automatically re-validates.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";
import useInPageAlert from "../../hooks/useInPageAlert";
import {
  assignReviewerWithGemini,
  getAvailableReviewers,
} from "../../utils/geminiReviewerAssignment";
import InPageAlert from "../InPageAlert";
import "../styles/workflow.css";

const API_BASE = "http://localhost:5000/api";

const STAGES = [
  "Draft",
  "Planning",
  "Review",
  "Update",
  "Ready-To-Post",
  "Posted",
];

const stageBadgeClass = (stage) => {
  const map = {
    Draft: "badge badge-draft",
    Planning: "badge badge-planning",
    Review: "badge badge-review",
    Update: "badge badge-update",
    "Ready-To-Post": "badge badge-ready",
    Posted: "badge badge-posted",
  };
  return map[stage] || "badge";
};

const Workflow = () => {
  const { user } = useAuth();

  // Stage & content
  const [selectedStage, setSelectedStage] = useState("Draft");
  const [items, setItems] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);

  // Templates from Firestore
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Validation
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Apply fixes
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  const [fixesSummary, setFixesSummary] = useState([]);
  const [showFixesSummary, setShowFixesSummary] = useState(false);

  // Reviewer management
  const [availableReviewers, setAvailableReviewers] = useState([]);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const [assigningReviewer, setAssigningReviewer] = useState(false);
  const [reviewerError, setReviewerError] = useState("");
  const [currentReviewerName, setCurrentReviewerName] = useState(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { alertState, showAlert, dismissAlert } = useInPageAlert();

  // ---- Fetch templates from Firestore ----
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/templates`);
      const data = await res.json();
      setTemplates(data);

      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, [selectedTemplateId]);

  // ---- Auto-move validated items to Review ----
  const autoMoveValidatedItems = useCallback(async (itemsList) => {
    let itemsMoved = false;
    try {
      for (const item of itemsList) {
        // If item has validation score >= 80 but is still in Draft, move it to Review
        if (item.validation?.brandScore >= 80 && item.stage === "Draft") {
          await updateDoc(doc(db, "content", item.id), {
            stage: "Review",
          });
          itemsMoved = true;
        }
      }
    } catch (err) {
      console.error("Error auto-moving validated items:", err);
    }
    return itemsMoved;
  }, []);

  // ---- Fetch content ----
  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setError("User not authenticated.");
        setItems([]);
        return;
      }

      const q = query(
        collection(db, "content"),
        where("createdBy", "==", uid),
        where("stage", "==", selectedStage),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

      // Auto-move items with score >= 80 from Draft to Review
      if (selectedStage === "Draft") {
        const itemsMoved = await autoMoveValidatedItems(results);
        // If items were moved, refetch to show updated list
        if (itemsMoved) {
          const updatedSnapshot = await getDocs(q);
          const updatedResults = updatedSnapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          setItems(updatedResults);

          // Auto-select first item or clear if none left
          if (updatedResults.length > 0) {
            const refreshed = selectedContent
              ? updatedResults.find((r) => r.id === selectedContent.id)
              : null;
            const next = refreshed || updatedResults[0];
            setSelectedContent(next);
            setValidationResult(next.validation || null);
            setShowValidationPanel(!!next.validation);
          } else {
            setSelectedContent(null);
            setValidationResult(null);
            setShowValidationPanel(false);
          }
        } else {
          setItems(results);
          // Auto-select first item if no content is selected or prev content not in new list
          if (selectedContent) {
            const refreshed = results.find((r) => r.id === selectedContent.id);
            if (refreshed) {
              setSelectedContent(refreshed);
              setValidationResult(refreshed.validation || null);
              setShowValidationPanel(!!refreshed.validation);
            } else {
              const fallback = results[0] || null;
              setSelectedContent(fallback);
              setValidationResult(fallback?.validation || null);
              setShowValidationPanel(!!fallback?.validation);
            }
          } else if (results.length > 0) {
            setSelectedContent(results[0]);
            setValidationResult(results[0].validation || null);
            setShowValidationPanel(!!results[0].validation);
          }
        }
      } else {
        setItems(results);

        if (selectedContent) {
          //Sync with fresh Firestore results
          const refreshed = results.find((r) => r.id === selectedContent.id);
          if (refreshed) {
            // Update with latest data from Firestore — this is what was missing
            setSelectedContent(refreshed);
            setValidationResult(refreshed.validation || null);
            setShowValidationPanel(!!refreshed.validation);
          } else {
            //Item no longer in this stage (e.g. moved to Review)
            const fallback = results[0] || null;
            setSelectedContent(fallback);
            setValidationResult(fallback?.validation || null);
            setShowValidationPanel(!!fallback?.validation);
          }
          } else if (results.length > 0) {
            setSelectedContent(results[0]);
            setValidationResult(results[0].validation || null);
            setShowValidationPanel(!!results[0].validation);
          }
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStage, selectedContent, autoMoveValidatedItems]);

  // ---- Validate content ----
  const handleValidateContent = async () => {
    if (!selectedContent) {
      showAlert("Please select content to validate.", "warning");
      return;
    }

    if (!selectedTemplateId) {
      showAlert("Please select a template to validate against.", "warning");
      return;
    }

    setIsValidating(true);
    setFixesSummary([]);
    setShowFixesSummary(false);

    try {
      const res = await fetch(`${API_BASE}/ai/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedContent.id,
          templateId: selectedTemplateId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert(data.error || "Validation failed.", "error");
        return;
      }

      setValidationResult(data.validation);
      setShowValidationPanel(true);

      // Auto-advance to Review only if brand score >= 80
      if (data.validation?.brandScore >= 80) {
        const reviewers = await getAvailableReviewers(
          db, collection, query, getDocs
        );
        const assignedReviewerId = await assignReviewerWithGemini(
          selectedContent, reviewers
        );

        const updatePayload = {
          stage: "Review",
          validation: data.validation,
          validatedTemplateId: selectedTemplateId,
          validatedAt: new Date().toISOString(),
        };

        if (assignedReviewerId) {
          updatePayload.reviewerId = assignedReviewerId;
          updatePayload.assignedAt = new Date().toISOString();
        }

        await updateDoc(
          doc(db, "content", selectedContent.id),
          updatePayload
        );
        setSelectedContent((prev) =>
          prev ? { ...prev, ...updatePayload } : prev
        );

        // Manually fetch Review stage items to show the moved item without waiting for state update
        try {
          const uid = auth.currentUser?.uid;
          const q = query(
            collection(db, "content"),
            where("createdBy", "==", uid),
            where("stage", "==", "Review"),
            limit(50)
          );
          const snapshot = await getDocs(q);
          const reviewItems = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

          // Update state with newly moved item
          setItems(reviewItems);
          if (reviewItems.length > 0) {
            const movedItem = reviewItems.find((item) => item.id === selectedContent.id) || reviewItems[0];
            setSelectedContent(movedItem);
            setValidationResult(movedItem.validation || null);
            setShowValidationPanel(!!movedItem.validation);
          }

          // Now switch stage
          setSelectedStage("Review");
        } catch (err) {
          console.error("Error fetching Review items:", err);
        }

        showAlert(
          assignedReviewerId
            ? "✅ Content passed! Moved to Review stage with reviewer assigned."
            : "✅ Content passed! Moved to Review stage.",
          "success"
        );
      } else {
        // Validation complete but score < 80 — keep in Draft and store validation
        await updateDoc(
          doc(db, "content", selectedContent.id),
          {
            validation: data.validation,
            validatedTemplateId: selectedTemplateId,
            validatedAt: new Date().toISOString(),
          }
        );
        setSelectedContent((prev) =>
          prev
            ? {
                ...prev,
                validation: data.validation,
                validatedTemplateId: selectedTemplateId,
                validatedAt: new Date().toISOString(),
              }
            : prev
        );
        //Sync the items list so badges reflect new score immediately
        setItems((prev) =>
          prev.map((item) =>
            item.id === selectedContent.id
              ? {
                  ...item,
                  validation: data.validation,
                  validatedTemplateId: selectedTemplateId,
                  validatedAt: new Date().toISOString(),
                }
              : item
          )
        );
        showAlert(
          "Content validated. Brand score is below 80. Apply fixes to improve and meet Review threshold.",
          "warning"
        );
      }
    } catch (err) {
      console.error("Validation error:", err);
      showAlert("Error validating content. Check your connection.", "error");
    } finally {
      setIsValidating(false);
    }
  };

  // ---- Apply AI fixes ----
  const handleApplyFixes = async () => {
    if (!selectedContent) return;

    setIsApplyingFixes(true);
    setShowFixesSummary(false);

    try {
      const res = await fetch(`${API_BASE}/ai/apply-fixes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedContent.id,
          templateId: selectedTemplateId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert(data.error || "Failed to apply fixes.", "error");
        return;
      }

      // Update local state with the fixed content
      setSelectedContent((prev) => ({
        ...prev,
        title: data.fixedTitle || prev.title,
        text: data.fixedText || prev.text,
      }));

      // Also update the item in the list so the preview reflects changes
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedContent.id
            ? { ...item, title: data.fixedTitle || item.title, text: data.fixedText || item.text }
            : item
        )
      );

      setFixesSummary(data.changesSummary || []);
      setShowFixesSummary(true);

      showAlert("Fixes applied. Re-validating content…", "success");

      // Auto re-validate after fixes
      await revalidateAfterFixes();
    } catch (err) {
      console.error("Apply fixes error:", err);
      showAlert("Error applying fixes.", "error");
    } finally {
      setIsApplyingFixes(false);
    }
  };

  // ---- Re-validate after fixes ----
  const revalidateAfterFixes = async () => {
    try {
      const res = await fetch(`${API_BASE}/ai/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedContent.id,
          templateId: selectedTemplateId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setValidationResult(data.validation);

        await updateDoc(doc(db, "content", selectedContent.id), {
          validation: data.validation,
          validatedTemplateId: selectedTemplateId,
          validatedAt: new Date().toISOString(),
        });

        setSelectedContent((prev) =>
          prev
            ? {
                ...prev,
                validation: data.validation,
                validatedTemplateId: selectedTemplateId,
                validatedAt: new Date().toISOString(),
              }
            : prev
        );

        //Sync the items list so badges update immediately without waiting for re-fetch
        setItems((prev) =>
          prev.map((item) =>
            item.id === selectedContent.id
              ? { ...item, validation: data.validation }
              : item
          )
        );

        if (data.validation?.compliance) {
          showAlert(
            "Re-validation passed! Content now meets guidelines.",
            "success"
          );
        } else {
          showAlert(
            "Content improved but still has some issues. Review the suggestions.",
            "warning"
          );
        }
      }
    } catch (err) {
      console.error("Re-validation error:", err);
    }
  };

  // ---- Fetch reviewers ----
  const fetchReviewers = async () => {
    if (!user?.uid || user?.role !== "admin") {
      setAvailableReviewers([]);
      return;
    }

    try {
      const reviewers = await getAvailableReviewers(
        db, collection, query, getDocs
      );
      setAvailableReviewers(reviewers);
    } catch (err) {
      console.error("Error fetching reviewers:", err);
      setReviewerError("Failed to load reviewers");
    }
  };

  // ---- Assign reviewer ----
  const handleAssignReviewer = async () => {
    if (
      !selectedReviewer ||
      !selectedContent ||
      !user?.uid ||
      user?.role !== "admin"
    ) {
      setReviewerError("Please select a reviewer");
      return;
    }

    setAssigningReviewer(true);
    setReviewerError("");

    try {
      const response = await fetch(`${API_BASE}/team/assign-reviewer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: user.uid,
          contentId: selectedContent.id,
          reviewerId: selectedReviewer,
          teamId: user.teamId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign reviewer");
      }

      const data = await response.json();
      showAlert(`Reviewer assigned: ${data.reviewerName}`, "success");

      setSelectedContent({
        ...selectedContent,
        reviewerId: selectedReviewer,
        assignedAt: new Date().toISOString(),
      });

      setSelectedReviewer(null);
      await fetchContent();
    } catch (err) {
      console.error("Error assigning reviewer:", err);
      setReviewerError(err.message || "Failed to assign reviewer");
    } finally {
      setAssigningReviewer(false);
    }
  };

  // ---- Effects ----
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchContent();
    setValidationResult(null);
    setShowValidationPanel(false);
    setFixesSummary([]);
    setShowFixesSummary(false);

    if (selectedStage === "Review" && user?.role === "admin") {
      fetchReviewers();
    }
  }, [selectedStage, user?.role, user?.uid]);

  useEffect(() => {
    const fetchReviewerName = async () => {
      if (!selectedContent?.reviewerId) {
        setCurrentReviewerName(null);
        return;
      }

      try {
        const reviewerDoc = await getDoc(
          doc(db, "Users", selectedContent.reviewerId)
        );
        if (reviewerDoc.exists()) {
          const rd = reviewerDoc.data();
          setCurrentReviewerName(
            rd.firstName && rd.lastName
              ? `${rd.firstName} ${rd.lastName}`
              : rd.name || rd.email || "Unknown"
          );
        } else {
          setCurrentReviewerName("Not Found");
        }
      } catch {
        setCurrentReviewerName("Unable to Load");
      }
    };

    fetchReviewerName();
  }, [selectedContent?.reviewerId]);

  // ---- Derived ----
  const selectedTemplateName =
    templates.find((t) => t.id === selectedTemplateId)?.name || "None";

  const brandScoreColor =
    validationResult?.brandScore >= 80
      ? "#16a34a"
      : validationResult?.brandScore >= 40
        ? "#f59e0b"
        : "#dc2626";

  // ---- Render ----
  return (
    <div className="workflow-bg">
      <InPageAlert alertState={alertState} onClose={dismissAlert} />
      <div className="workflow-page modern">
        {/* Header */}
        <div className="wf-header">
          <div>
            <h2 className="modern-title">Workflow</h2>
            <p className="wf-subtitle">
              Manage your content stages and validate with AI
            </p>
          </div>

          <div className="wf-stage-select">
            <span className="wf-label">Currently Viewing</span>
            <div className="select-wrap">
              <select
                className="select"
                value={selectedStage}
                onChange={(e) => {
                  setSelectedStage(e.target.value);
                  setSelectedContent(null);
                }}
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
          {/* LEFT — Content List */}
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
              {error && <div className="wf-alert wf-alert-error">{error}</div>}

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
                    <li
                      key={item.id}
                      className={`wf-item ${selectedContent?.id === item.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedContent(item);
                        setValidationResult(item.validation || null);
                        setShowValidationPanel(!!item.validation);
                        // If item has validation, set the template it was validated against
                        if (item.validatedTemplateId) {
                          setSelectedTemplateId(item.validatedTemplateId);
                        }
                        setFixesSummary([]);
                        setShowFixesSummary(false);
                      }}
                    >
                      <div className="wf-item-top">
                        <div className="wf-item-title">{item.title}</div>
                        <span className={stageBadgeClass(item.stage)}>
                          {item.stage}
                        </span>
                      </div>
                      <div className="wf-item-text">
                        {item.text?.substring(0, 120)}
                        {item.text?.length > 120 ? "…" : ""}
                      </div>
                      {item.validation && (
                        <div className="wf-item-validation">
                          <span className={`wf-validation-badge ${item.validation.brandScore >= 80 ? "score-high" : "score-low"}`}>
                            {item.validation.brandScore}/100
                          </span>
                          {item.validation.brandScore >= 80 ? (
                            <span className="wf-validation-status valid">✓ Ready for Review</span>
                          ) : (
                            <span className="wf-validation-status invalid">⚠ Needs Fixes</span>
                          )}
                        </div>
                      )}
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

          {/* RIGHT — Panels */}
          <div className="wf-right-panels">
            {/* AI Validation Panel */}
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
                    {/* Template selector — dynamic from Firestore */}
                    <div className="validation-section">
                      <label className="validation-label">
                        Select Template
                      </label>
                      <div className="select-wrap">
                        <select
                          className="select validation-select"
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                        >
                          {templates.length === 0 && (
                            <option value="">Loading templates…</option>
                          )}
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name || t.id}
                            </option>
                          ))}
                        </select>
                        <span className="select-caret">▾</span>
                      </div>
                    </div>

                    {/* Validate button */}
                    <button
                      className="validate-btn"
                      onClick={handleValidateContent}
                      disabled={!selectedContent || isValidating}
                    >
                      {isValidating ? (
                        <span className="btn-loading">
                          <span className="spinner" />
                          Validating…
                        </span>
                      ) : (
                        "Validate Content"
                      )}
                    </button>

                    <div className="validation-info">
                      <p>
                        <strong>Select a template</strong> to validate your
                        content against.
                      </p>
                      <p>
                        <strong>Click "Validate Content"</strong> to start the
                        AI analysis.
                      </p>
                    </div>
                  </div>
                ) : validationResult ? (
                  <div className="validation-results">
                    {/* Header */}
                    <div className="result-header">
                      <div className="result-info">
                        <div className="result-content-title">
                          {selectedContent?.title}
                        </div>
                        <div className="result-template">
                          Template: <strong>{selectedTemplateName}</strong>
                        </div>
                        {validationResult.validatedAt && (
                          <div className="result-timestamp">
                            Last Validated:{" "}
                            {new Date(validationResult.validatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn-back"
                        onClick={() => {
                          setShowValidationPanel(false);
                          setValidationResult(null);
                          setFixesSummary([]);
                          setShowFixesSummary(false);
                        }}
                      >
                        ← Back
                      </button>
                    </div>

                    {/* Compliance status */}
                    <div className="review-status">
                      {validationResult.compliance ? (
                        <span className="status-badge valid">
                          ✓ Content Valid — Meets Guidelines
                        </span>
                      ) : (
                        <span className="status-badge invalid">
                          ⚠ Needs Fixes — Does Not Meet Guidelines
                        </span>
                      )}
                    </div>

                    {/* Brand score */}
                    <div className="score-section">
                      <div className="score-label">Brand Consistency Score</div>
                      <div className="score-display">
                        <div className="score-number" style={{ color: brandScoreColor }}>
                          {validationResult.brandScore}
                        </div>
                        <div className="score-max">/100</div>
                        <div className="score-circle">
                          <svg viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e5e5" strokeWidth="8" />
                            <circle
                              cx="60" cy="60" r="54" fill="none"
                              stroke={brandScoreColor}
                              strokeWidth="8"
                              strokeDasharray={`${(validationResult.brandScore / 100) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                              transform="rotate(-90 60 60)"
                              style={{ transition: "stroke-dasharray 0.6s ease" }}
                            />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Missing sections */}
                    {validationResult.missingSections?.length > 0 && (
                      <div className="missing-sections">
                        <div className="suggestions-title">Missing Required Sections</div>
                        <div className="missing-list">
                          {validationResult.missingSections.map((section, idx) => (
                            <span key={idx} className="missing-tag">{section}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    <div className="suggestions-section">
                      <div className="suggestions-title">AI Suggestions / Fixes</div>
                      <div className="suggestions-list">
                        {validationResult.suggestions?.length > 0 ? (
                          validationResult.suggestions.map((suggestion, idx) => (
                            <div key={idx} className="suggestion-item">
                              <span className="suggestion-icon">●</span>
                              <span className="suggestion-text">{suggestion}</span>
                            </div>
                          ))
                        ) : (
                          <div className="suggestion-item">
                            <span className="suggestion-icon">✓</span>
                            <span className="suggestion-text">
                              No suggestions — content looks great!
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fixes summary */}
                    {showFixesSummary && fixesSummary.length > 0 && (
                      <div className="fixes-summary">
                        <div className="fixes-summary-title">Changes Applied</div>
                        <div className="fixes-summary-list">
                          {fixesSummary.map((change, idx) => (
                            <div key={idx} className="fix-change-item">
                              <span className="fix-change-icon">→</span>
                              <span className="fix-change-text">{change}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Apply Fixes — only when not compliant */}
                    {!validationResult.compliance && (
                      <button
                        className="apply-fixes-btn"
                        onClick={handleApplyFixes}
                        disabled={isApplyingFixes}
                      >
                        {isApplyingFixes ? (
                          <span className="btn-loading">
                            <span className="spinner" />
                            Applying Fixes…
                          </span>
                        ) : (
                          "Apply AI Fixes & Re-Validate"
                        )}
                      </button>
                    )}

                    {/* Re-validate if already compliant */}
                    {validationResult.compliance && (
                      <button
                        className="validate-btn revalidate-btn"
                        onClick={handleValidateContent}
                        disabled={isValidating}
                      >
                        {isValidating ? "Re-Validating…" : "Re-Validate"}
                      </button>
                    )}

                    {/* Indicators */}
                    <div className="validation-indicators">
                      <div className={`indicator ${validationResult.compliance ? "active" : ""}`}>
                        <span className={`indicator-dot ${validationResult.compliance ? "valid" : ""}`}>●</span>
                        Valid
                      </div>
                      <div className={`indicator ${validationResult.suggestions?.length > 0 ? "active" : ""}`}>
                        <span className={`indicator-dot ${validationResult.suggestions?.length > 0 ? "warning" : ""}`}>●</span>
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

            {/* Assign Reviewer — Review stage, admins only */}
            {selectedStage === "Review" && user?.role === "admin" && selectedContent && (
              <aside className="wf-card reviewer-card">
                <div className="wf-card-header">
                  <div className="wf-card-title">Assign Reviewer 👤</div>
                </div>

                <div className="wf-card-body">
                  <div className="reviewer-assignment">
                    <div className="reviewer-section">
                      <div className="reviewer-subtitle">Current Assignment</div>
                      {selectedContent.reviewerId ? (
                        <div className="reviewer-assigned">
                          <span className="reviewer-badge">✓ Assigned</span>
                          <div className="reviewer-id-text">
                            {currentReviewerName} ({selectedContent.reviewerId})
                          </div>
                        </div>
                      ) : (
                        <div className="reviewer-unassigned">
                          <span className="reviewer-badge-empty">⊘ Not Assigned</span>
                        </div>
                      )}
                    </div>

                    <div className="reviewer-section">
                      <label className="reviewer-label">Select Reviewer</label>
                      {availableReviewers.length > 0 ? (
                        <>
                          <div className="select-wrap">
                            <select
                              className="select reviewer-select"
                              value={selectedReviewer || ""}
                              onChange={(e) => setSelectedReviewer(e.target.value)}
                            >
                              <option value="">Choose a reviewer...</option>
                              {availableReviewers.map((reviewer) => (
                                <option key={reviewer.uid} value={reviewer.uid}>
                                  {reviewer.name || reviewer.email} ({reviewer.currentLoad || 0}/5)
                                </option>
                              ))}
                            </select>
                            <span className="select-caret">▾</span>
                          </div>

                          <button
                            className="assign-reviewer-btn"
                            onClick={handleAssignReviewer}
                            disabled={!selectedReviewer || assigningReviewer}
                          >
                            {assigningReviewer ? "Assigning..." : "Assign Reviewer"}
                          </button>
                        </>
                      ) : (
                        <div className="reviewer-empty">
                          <p>No reviewers available in your team.</p>
                          <small>Add team members with "reviewer" role to assign reviews.</small>
                        </div>
                      )}

                      {reviewerError && (
                        <div className="reviewer-error">{reviewerError}</div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>

        <p className="workflow-note modern-note">
          AI validation powered by Gemini API
        </p>
      </div>
    </div>
  );
};

export default Workflow;