/**
 * ReviewerCard Component - Tanvir
 * Handles reviewer assignment in Review stage
 */

import React from "react";

const ReviewerCard = ({
  selectedStage,
  userRole,
  selectedContent,
  currentReviewerName,
  availableReviewers,
  selectedReviewer,
  assigningReviewer,
  reviewerError,
  onSelectReviewer,
  onAssignReviewer,
}) => {
  // Only show for Review stage and admin users
  if (selectedStage !== "Review" || userRole !== "admin" || !selectedContent) {
    return null;
  }

  return (
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
                    onChange={(e) => onSelectReviewer(e.target.value)}
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
                  onClick={onAssignReviewer}
                  disabled={!selectedReviewer || assigningReviewer}
                >
                  {assigningReviewer ? "Assigning..." : "Assign Reviewer"}
                </button>
              </>
            ) : (
              <div className="reviewer-empty">
                <p>No reviewers available in your team.</p>
                <small>
                  Add team members with "reviewer" role to assign reviews.
                </small>
              </div>
            )}

            {reviewerError && (
              <div className="reviewer-error">{reviewerError}</div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ReviewerCard;
