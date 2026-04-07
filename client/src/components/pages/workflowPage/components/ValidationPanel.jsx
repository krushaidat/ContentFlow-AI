/**
 * ValidationPanel Component - Tanvir
 * Displays AI validation results and provides fix options
 */

import React from "react";

const ValidationPanel = ({
  showValidationPanel,
  validationResult,
  selectedContent,
  selectedTemplateId,
  selectedTemplateName,
  templates,
  isValidating,
  isApplyingFixes,
  showFixesSummary,
  fixesSummary,
  onValidate,
  onApplyFixes,
  onBack,
  onTemplateChange,
}) => {
  const brandScoreColor =
    validationResult?.brandScore >= 80
      ? "#16a34a"
      : validationResult?.brandScore >= 40
        ? "#f59e0b"
        : "#dc2626";

  return (
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
              <label className="validation-label">Select Template</label>
              <div className="select-wrap">
                <select
                  className="select validation-select"
                  value={selectedTemplateId}
                  onChange={(e) => onTemplateChange(e.target.value)}
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
              onClick={onValidate}
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
                <strong>Select a template</strong> to validate your content
                against.
              </p>
              <p>
                <strong>Click "Validate Content"</strong> to start the AI
                analysis.
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
              <button className="btn-back" onClick={onBack}>
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
                    <span key={idx} className="missing-tag">
                      {section}
                    </span>
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
                onClick={onApplyFixes}
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
                onClick={onValidate}
                disabled={isValidating}
              >
                {isValidating ? "Re-Validating…" : "Re-Validate"}
              </button>
            )}

            {/* Indicators */}
            <div className="validation-indicators">
              <div
                className={`indicator ${
                  validationResult.compliance ? "active" : ""
                }`}
              >
                <span
                  className={`indicator-dot ${
                    validationResult.compliance ? "valid" : ""
                  }`}
                >
                  ●
                </span>
                Valid
              </div>
              <div
                className={`indicator ${
                  validationResult.suggestions?.length > 0 ? "active" : ""
                }`}
              >
                <span
                  className={`indicator-dot ${
                    validationResult.suggestions?.length > 0 ? "warning" : ""
                  }`}
                >
                  ●
                </span>
                Improvements
              </div>
              <div
                className={`indicator ${
                  !validationResult.compliance ? "active" : ""
                }`}
              >
                <span
                  className={`indicator-dot ${
                    !validationResult.compliance ? "error" : ""
                  }`}
                >
                  ●
                </span>
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
  );
};

export default ValidationPanel;
