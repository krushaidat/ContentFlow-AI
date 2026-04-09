/**
 * Workflow Constants and Utilities
 * Contains shared constants, configuration, and utility functions
 */

export const API_BASE = "http://localhost:5000/api";

export const STAGES = [
  "Draft",
  "Review",
  "Update",
  "Ready-To-Post",
  "Posted",
];

export const stageBadgeClass = (stage) => {
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
