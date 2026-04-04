/**
 * ContentList Component - Tanvir
 * Displays content items grouped by workflow stage
 */

import React from "react";
import { stageBadgeClass } from "../constants";

const ContentList = ({
  selectedStage,
  items,
  loading,
  error,
  selectedContent,
  onSelectContent,
  onStageChange,
  STAGES,
  highlightedContentId,
}) => {
  return (
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
                className={`wf-item ${selectedContent?.id === item.id ? "active" : ""} ${highlightedContentId === item.id ? "notification-highlight" : ""}`}
                onClick={() => onSelectContent(item)}
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
                    <span
                      className={`wf-validation-badge ${
                        item.validation.brandScore >= 90
                          ? "score-high"
                          : "score-low"
                      }`}
                    >
                      {item.validation.brandScore}/100
                    </span>
                    {item.validation.brandScore >= 90 ? (
                      <span className="wf-validation-status valid">
                        ✓ Ready for Review
                      </span>
                    ) : (
                      <span className="wf-validation-status invalid">
                        ⚠ Needs Fixes
                      </span>
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
  );
};

export default ContentList;
