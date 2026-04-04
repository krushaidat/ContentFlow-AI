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
  assigningReviewer,
  reviewerError,
}) => {
  const currentAssignmentId = selectedContent?.reviewerId;

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
            {currentAssignmentId ? (
              <div className="reviewer-assigned">
                <span className="reviewer-badge">✓ Assigned</span>
                <div className="reviewer-id-text">
                  {currentReviewerName} ({currentAssignmentId})
                </div>
              </div>
            ) : (
              <div className="reviewer-unassigned">
                <span className="reviewer-badge-empty">⊘ Not Assigned</span>
              </div>
            )}
          </div>

          <div className="reviewer-section">
            <label className="reviewer-label">Auto Assignment</label>
            {availableReviewers.length > 0 ? (
              <div className="reviewer-empty">
                {assigningReviewer ? (
                  <p>Assigning reviewer automatically...</p>
                ) : currentAssignmentId ? (
                  <p>Reviewer assignment is automatic in Review stage.</p>
                ) : (
                  <p>Reviewer will be assigned automatically.</p>
                )}
              </div>
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
