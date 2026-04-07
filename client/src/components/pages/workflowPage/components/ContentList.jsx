/**
 * ContentList Component - Tanvir (UI refreshed)
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
  onViewContent,
  onStageChange,
  STAGES,
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
            {items.map((item) => {
              const isActive = selectedContent?.id === item.id;
              const brandScore = item.validation?.brandScore;
              const hasValidation = item.validation != null;

              return (
                <li
                  key={item.id}
                  className={`wf-item ${isActive ? "active" : ""}`}
                  onClick={() => onSelectContent(item)}
                >
                  {/* Top row: title + view btn */}
                  <div className="wf-item-top">
                    <div className="wf-item-title">{item.title}</div>
                    <div className="wf-item-actions">
                      <button
                        className="wf-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewContent(item);
                        }}
                        title="View full content"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Preview text */}
                  <div className="wf-item-text">
                    {item.text?.substring(0, 100)}
                    {item.text?.length > 100 ? "…" : ""}
                  </div>

                  {/* Bottom row: validation + date */}
                  <div className="wf-item-bottom">
                    {hasValidation && (
                      <div className="wf-item-validation">
                        <span
                          className={`wf-score-chip ${
                            brandScore >= 80
                              ? "score-high"
                              : brandScore >= 60
                                ? "score-mid"
                                : "score-low"
                          }`}
                        >
                          {brandScore}/100
                        </span>
                        {brandScore >= 80 ? (
                          <span className="wf-status-tag valid">✓ Ready</span>
                        ) : (
                          <span className="wf-status-tag invalid">⚠ Needs Fixes</span>
                        )}
                      </div>
                    )}
                    <span className="wf-item-date">
                      {String(item.createdAt).slice(0, 10)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ContentList;