/**
 * ContentViewModal Component
 * Displays full content details in a modal popup
 */

import React from "react";
import { stageBadgeClass } from "../constants";

const ContentViewModal = ({ content, onClose }) => {
  if (!content) return null;

  const brandScore = content.validation?.brandScore;
  const hasValidation = content.validation != null;

  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cv-header">
          <div className="cv-header-left">
            <span className={stageBadgeClass(content.stage)}>
              {content.stage}
            </span>
            {hasValidation && (
              <span
                className={`cv-score-pill ${brandScore >= 80 ? "score-high" : brandScore >= 60 ? "score-mid" : "score-low"}`}
              >
                {brandScore}/100
              </span>
            )}
          </div>
          <button className="cv-close" onClick={onClose} title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="cv-body">
          <h2 className="cv-title">{content.title || "Untitled"}</h2>

          <div className="cv-meta-row">
            <span className="cv-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {content.createdAt
                ? new Date(content.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Unknown date"}
            </span>
            {content.type && (
              <span className="cv-meta-item cv-meta-type">{content.type}</span>
            )}
          </div>

          {/* Full content text */}
          <div className="cv-content-text">
            {content.text || "No content body."}
          </div>

          {/* Validation details if present */}
          {hasValidation && (
            <div className="cv-validation-section">
              <div className="cv-section-label">Validation Results</div>
              <div className="cv-validation-grid">
                <div className="cv-val-item">
                  <span className="cv-val-label">Brand Score</span>
                  <span
                    className={`cv-val-value ${brandScore >= 80 ? "text-green" : brandScore >= 60 ? "text-amber" : "text-red"}`}
                  >
                    {brandScore}/100
                  </span>
                </div>
                <div className="cv-val-item">
                  <span className="cv-val-label">Compliance</span>
                  <span
                    className={`cv-val-value ${content.validation.compliance ? "text-green" : "text-red"}`}
                  >
                    {content.validation.compliance ? "Meets Guidelines" : "Needs Fixes"}
                  </span>
                </div>
              </div>

              {content.validation.suggestions?.length > 0 && (
                <div className="cv-suggestions">
                  <div className="cv-section-sublabel">Suggestions</div>
                  <ul className="cv-suggestion-list">
                    {content.validation.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {content.validation.missingSections?.length > 0 && (
                <div className="cv-missing">
                  <div className="cv-section-sublabel">Missing Sections</div>
                  <div className="cv-tag-row">
                    {content.validation.missingSections.map((s, i) => (
                      <span key={i} className="cv-tag">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rejection reason */}
          {content.rejectionReason && (
            <div className="cv-rejection">
              <div className="cv-section-label">Reviewer Feedback</div>
              <p>{content.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cv-footer">
          <button className="cv-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentViewModal;