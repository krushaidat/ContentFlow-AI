/**
 * useValidation Hook
 * Handles AI content validation and result management
 */

import { useState } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db, auth } from "../../../../firebase";
import { API_BASE } from "../constants";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";

export const useValidation = () => {
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const handleValidateContent = async (
    selectedContent,
    selectedTemplateId,
    showAlert
  ) => {
    if (!selectedContent) {
      showAlert("Please select content to validate.", "warning");
      return;
    }

    if (!selectedTemplateId) {
      showAlert("Please select a template to validate against.", "warning");
      return;
    }

    setIsValidating(true);

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

      if (!res.ok || !data.success) {
        showAlert(data.error || "Validation failed.", "error");
        return;
      }

      setValidationResult(data.validation);
      setShowValidationPanel(true);

      // Store validation in Firestore
      await updateDoc(doc(db, "content", selectedContent.id), {
        validation: data.validation,
        validatedTemplateId: selectedTemplateId,
        validatedAt: new Date().toISOString(),
      });

      return data.validation;
    } catch (err) {
      console.error("Validation error:", err);
      showAlert("Error validating content. Check your connection.", "error");
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validationResult,
    setValidationResult,
    showValidationPanel,
    setShowValidationPanel,
    isValidating,
    handleValidateContent,
  };
};
