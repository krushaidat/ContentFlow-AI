/**
 * Workflow Page
 * Authors: Abdalaa, Tanvir (refactored)
 *
 * Orchestrates content workflow with dynamic stages, AI validation,
 * automatic fixes, and reviewer assignment.
 */

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { useAuth } from "../../../hooks/useAuth";
import useInPageAlert from "../../../hooks/useInPageAlert";
import {
  getAvailableReviewers,
  assignReviewerWithGemini,
} from "../../../utils/geminiReviewerAssignment";
import InPageAlert from "../../InPageAlert";

// Hooks
import { useTemplates } from "./hooks/useTemplates";
import { useWorkflowContent } from "./hooks/useWorkflowContent";
import { useValidation } from "./hooks/useValidation";
import { useFixes } from "./hooks/useFixes";
import { useReviewers } from "./hooks/useReviewers";

// Components
import ContentList from "./components/ContentList";
import ValidationPanel from "./components/ValidationPanel";
import ReviewerCard from "./components/ReviewerCard";
import ContentViewModal from "./components/ContentViewModal";

// Constants
import { STAGES, API_BASE } from "./constants";

// Styles
import "../../styles/workflow.css";

const Workflow = () => {
  const { user } = useAuth();
  const { alertState, showAlert, dismissAlert } = useInPageAlert();

  // View modal state
  const [viewContent, setViewContent] = useState(null);

  // Content management
  const {
    selectedStage,
    setSelectedStage,
    items,
    setItems,
    selectedContent,
    setSelectedContent,
    loading,
    error,
    fetchContent,
  } = useWorkflowContent();

  // Templates
  const {
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    fetchTemplates,
  } = useTemplates();

  // Validation
  const {
    validationResult,
    setValidationResult,
    showValidationPanel,
    setShowValidationPanel,
    isValidating,
    handleValidateContent,
  } = useValidation();

  // Fixes
  const {
    isApplyingFixes,
    fixesSummary,
    showFixesSummary,
    setShowFixesSummary,
    handleApplyFixes,
    revalidateAfterFixes,
  } = useFixes();

  // Reviewers
  const {
    availableReviewers,
    selectedReviewer,
    setSelectedReviewer,
    assigningReviewer,
    reviewerError,
    currentReviewerName,
    fetchReviewers,
    handleAssignReviewer,
    fetchReviewerName,
  } = useReviewers();

  // ---- Derived ----
  const selectedTemplateName =
    templates.find((t) => t.id === selectedTemplateId)?.name || "None";

  // ---- Effects ----
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchContent(selectedStage);
    setValidationResult(null);
    setShowValidationPanel(false);
    setShowFixesSummary(false);

    if (selectedStage === "Review" && user?.role === "admin") {
      fetchReviewers(user);
    }
  }, [selectedStage, user?.role, user?.uid]);

  useEffect(() => {
    // Aminah Update: fetch current reviewer name when content changes, prioritizing reviewerId then suggestedReviewerId
    const reviewerId =
      selectedContent?.reviewerId || selectedContent?.suggestedReviewerId;
    fetchReviewerName(reviewerId);
  }, [selectedContent?.reviewerId, selectedContent?.suggestedReviewerId]);

  // ---- Wrapped handlers ----
  const handleValidate = async () => {
    const validation = await handleValidateContent(
      selectedContent,
      selectedTemplateId,
      showAlert,
    );

    if (validation?.brandScore >= 90) {
      const reviewers = await getAvailableReviewers(
        db,
        collection,
        query,
        getDocs,
      );
      const assignedReviewerId = await assignReviewerWithGemini(
        selectedContent,
        reviewers,
      );

      const updatePayload = {
        stage: "Review",
        validation: validation,
        validatedTemplateId: selectedTemplateId,
        validatedAt: new Date().toISOString(),
      };

      if (assignedReviewerId) {
        updatePayload.suggestedReviewerId = assignedReviewerId;
      }

      await updateDoc(doc(db, "content", selectedContent.id), updatePayload);
      setSelectedContent((prev) =>
        prev ? { ...prev, ...updatePayload } : prev,
      );

      // Manually fetch Review stage items
      try {
        const uid = auth.currentUser?.uid;
        const q = query(
          collection(db, "content"),
          where("createdBy", "==", uid),
          where("stage", "==", "Review"),
          limit(50),
        );
        const snapshot = await getDocs(q);
        const reviewItems = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        setItems(reviewItems);
        if (reviewItems.length > 0) {
          const movedItem =
            reviewItems.find((item) => item.id === selectedContent.id) ||
            reviewItems[0];
          setSelectedContent(movedItem);
          setValidationResult(movedItem.validation || null);
          setShowValidationPanel(!!movedItem.validation);
          setSelectedReviewer(null);
        }

        setSelectedStage("Review");
      } catch (err) {
        console.error("Error fetching Review items:", err);
      }

      showAlert(
        assignedReviewerId
          ? "Content passed! Moved to Review stage with reviewer preselected. Click Assign Reviewer to confirm."
          : "Content passed! Moved to Review stage.",
        "success",
      );
    } else if (validation) {
      showAlert(
        "Content validated. Brand score is below 90. Apply fixes to improve and meet Review threshold.",
        "warning",
      );
    }
  };

  const handleFixes = async () => {
    const fixData = await handleApplyFixes(
      selectedContent,
      selectedTemplateId,
      showAlert,
      (data) => {
        setSelectedContent((prev) => ({
          ...prev,
          title: data.fixedTitle || prev.title,
          text: data.fixedText || prev.text,
        }));

        setItems((prev) =>
          prev.map((item) =>
            item.id === selectedContent.id
              ? {
                  ...item,
                  title: data.fixedTitle || item.title,
                  text: data.fixedText || item.text,
                }
              : item,
          ),
        );
      },
    );

    if (fixData) {
      await revalidateAfterFixes(
        selectedContent,
        selectedTemplateId,
        showAlert,
      );
      const revalidation = await handleValidateContent(
        selectedContent,
        selectedTemplateId,
        showAlert,
      );
      if (revalidation) {
        setValidationResult(revalidation);
      }
    }
  };

  const handleAssignReviewerClick = async () => {
    const effectiveReviewerId =
      selectedReviewer ||
      selectedContent?.suggestedReviewerId ||
      selectedContent?.reviewerId;

    const result = await handleAssignReviewer(
      user,
      selectedContent,
      effectiveReviewerId,
      showAlert,
    );

    if (result) {
      setSelectedContent({
        ...selectedContent,
        reviewerId: effectiveReviewerId,
        suggestedReviewerId: null,
        assignedAt: new Date().toISOString(),
      });
      setSelectedReviewer(null);
      await fetchContent(selectedStage);
    }
  };

  const handleSelectContent = (item) => {
    setSelectedContent(item);
    setSelectedReviewer(null);
    setValidationResult(item.validation || null);
    setShowValidationPanel(!!item.validation);
    if (item.validatedTemplateId) {
      setSelectedTemplateId(item.validatedTemplateId);
    }
    setShowFixesSummary(false);
  };

  // ---- Render ----
  return (
    <div className="workflow-bg">
      <InPageAlert alertState={alertState} onClose={dismissAlert} />
      <div className="workflow-page modern">
        {/* Header */}
        <div className="wf-header">
          <div>
            <h2 className="modern-title">Workflow</h2>
            <p className="wf-subtitle">
              Manage your content stages and validate with AI
            </p>
          </div>

          <div className="wf-stage-select">
            <span className="wf-label">Currently Viewing</span>
            <div className="select-wrap">
              <select
                className="select"
                value={selectedStage}
                onChange={(e) => {
                  setSelectedStage(e.target.value);
                  setSelectedContent(null);
                }}
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              <span className="select-caret">▾</span>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="wf-grid">
          {/* LEFT — Content List */}
          <ContentList
            selectedStage={selectedStage}
            items={items}
            loading={loading}
            error={error}
            selectedContent={selectedContent}
            onSelectContent={handleSelectContent}
            onViewContent={(item) => setViewContent(item)}
            onStageChange={setSelectedStage}
            STAGES={STAGES}
          />

          {/* RIGHT — Panels */}
          <div className="wf-right-panels">
            {/* Validation Panel */}
            <ValidationPanel
              showValidationPanel={showValidationPanel}
              validationResult={validationResult}
              selectedContent={selectedContent}
              selectedTemplateId={selectedTemplateId}
              selectedTemplateName={selectedTemplateName}
              templates={templates}
              isValidating={isValidating}
              isApplyingFixes={isApplyingFixes}
              showFixesSummary={showFixesSummary}
              fixesSummary={fixesSummary}
              onValidate={handleValidate}
              onApplyFixes={handleFixes}
              onTemplateChange={setSelectedTemplateId}
              onBack={() => {
                setShowValidationPanel(false);
                setValidationResult(null);
                setShowFixesSummary(false);
              }}
            />

            {/* Reviewer Card */}
            <ReviewerCard
              selectedStage={selectedStage}
              userRole={user?.role}
              selectedContent={selectedContent}
              currentReviewerName={currentReviewerName}
              availableReviewers={availableReviewers}
              selectedReviewer={selectedReviewer}
              assigningReviewer={assigningReviewer}
              reviewerError={reviewerError}
              onSelectReviewer={setSelectedReviewer}
              onAssignReviewer={handleAssignReviewerClick}
            />
          </div>
        </div>

        <p className="workflow-note modern-note">
          AI validation powered by Gemini API
        </p>
      </div>

      {/* Content View Modal */}
      {viewContent && (
        <ContentViewModal
          content={viewContent}
          onClose={() => setViewContent(null)}
        />
      )}
    </div>
  );
};

export default Workflow;