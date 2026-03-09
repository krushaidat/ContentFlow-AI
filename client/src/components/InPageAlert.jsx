import React from "react";
import "./styles/inPageAlert.css";

export default function InPageAlert({ alertState, onClose }) {
  if (!alertState) {
    return null;
  }

  return (
    <div className="inpage-alert-wrap" role="status" aria-live="polite">
      <div className={`inpage-alert inpage-alert-${alertState.type || "info"}`}>
        <span>{alertState.message}</span>
        <button
          type="button"
          className="inpage-alert-close"
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          x
        </button>
      </div>
    </div>
  );
}
