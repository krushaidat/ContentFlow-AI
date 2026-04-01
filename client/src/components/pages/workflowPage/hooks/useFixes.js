/**
 * useFixes Hook - tanvir
 * Handles applying AI fixes and re-validation
 */

import { useState } from "react";
import { API_BASE } from "../constants";

export const useFixes = () => {
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  const [fixesSummary, setFixesSummary] = useState([]);
  const [showFixesSummary, setShowFixesSummary] = useState(false);

  const handleApplyFixes = async (
    selectedContent,
    selectedTemplateId,
    showAlert,
    onFixesApplied
  ) => {
    if (!selectedContent) return;

    setIsApplyingFixes(true);
    setShowFixesSummary(false);

    try {
      const res = await fetch(`${API_BASE}/ai/apply-fixes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedContent.id,
          templateId: selectedTemplateId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert(data.error || "Failed to apply fixes.", "error");
        return;
      }

      setFixesSummary(data.changesSummary || []);
      setShowFixesSummary(true);

      showAlert("Fixes applied. Re-validating content…", "success");

      // Call the callback to trigger re-validation
      if (onFixesApplied) {
        onFixesApplied(data);
      }

      return data;
    } catch (err) {
      console.error("Apply fixes error:", err);
      showAlert("Error applying fixes.", "error");
    } finally {
      setIsApplyingFixes(false);
    }
  };

  const revalidateAfterFixes = async (
    selectedContent,
    selectedTemplateId,
    showAlert
  ) => {
    try {
      const res = await fetch(`${API_BASE}/ai/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedContent.id,
          templateId: selectedTemplateId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.validation?.compliance) {
          showAlert(
            "Re-validation passed! Content now meets guidelines.",
            "success"
          );
        } else {
          showAlert(
            "Content improved but still has some issues. Review the suggestions.",
            "warning"
          );
        }
        return data.validation;
      }
    } catch (err) {
      console.error("Re-validation error:", err);
    }
  };

  return {
    isApplyingFixes,
    fixesSummary,
    showFixesSummary,
    setShowFixesSummary,
    handleApplyFixes,
    revalidateAfterFixes,
  };
};
