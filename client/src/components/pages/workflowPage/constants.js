/**
 * Workflow Constants and Utilities
 * Contains shared constants, configuration, and utility functions
 */

export const API_BASE = "http://localhost:5000/api";

export const READY_TO_POST_STAGE = "Ready To Post";
export const READY_TO_POST_STAGE_ALIASES = [
  READY_TO_POST_STAGE,
  "Ready to Post",
  "Ready-To-Post",
];

export const normalizeStageLabel = (stage) =>
  READY_TO_POST_STAGE_ALIASES.includes(stage) ? READY_TO_POST_STAGE : stage;

export const STAGES = [
  "Draft",
  "Review",
  "Update",
  READY_TO_POST_STAGE,
  "Posted",
];

export const stageBadgeClass = (stage) => {
  const normalizedStage = normalizeStageLabel(stage);

  const map = {
    Draft: "badge badge-draft",
    Planning: "badge badge-planning",
    Review: "badge badge-review",
    Update: "badge badge-update",
    [READY_TO_POST_STAGE]: "badge badge-ready",
    Posted: "badge badge-posted",
  };
  return map[normalizedStage] || "badge";
};

/**
 * Review status enum and utilities
 */
export const REVIEW_STATUS = Object.freeze({
  ASSIGNED: "ASSIGNED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export const REVIEW_STATUS_LABEL = Object.freeze({
  [REVIEW_STATUS.ASSIGNED]: "Assigned",
  [REVIEW_STATUS.APPROVED]: "Approved",
  [REVIEW_STATUS.REJECTED]: "Rejected",
});

export const reviewStatusBadgeClass = (status) => {
  switch (status) {
    case REVIEW_STATUS.APPROVED:
      return "review-status approved";
    case REVIEW_STATUS.REJECTED:
      return "review-status rejected";
    case REVIEW_STATUS.ASSIGNED:
    default:
      return "review-status assigned";
  }
};

/**
 * deriveReviewStatus - Derives the review status of a content item based on its properties.
 */
export const deriveReviewStatus = (item) => {
  if (!item) return null;

  const code = String(item.reviewStatusCode || "").toUpperCase();
  if (code === REVIEW_STATUS.APPROVED) return REVIEW_STATUS.APPROVED;
  if (code === REVIEW_STATUS.REJECTED) return REVIEW_STATUS.REJECTED;
  if (code === REVIEW_STATUS.ASSIGNED) return REVIEW_STATUS.ASSIGNED;

  const legacy = String(item.reviewStatus || "").toLowerCase();
  if (legacy === "approved") return REVIEW_STATUS.APPROVED;
  if (legacy === "rejected") return REVIEW_STATUS.REJECTED;

  if (item.reviewerId) return REVIEW_STATUS.ASSIGNED;
  return null;
};