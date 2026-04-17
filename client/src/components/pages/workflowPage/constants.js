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
