/**
 * Workflow Page
 * Authors: Abdalaa, Tanvir (refactored)
 *
 * Orchestrates content workflow with dynamic stages, AI validation,
 * automatic fixes, and reviewer assignment.
 */


import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  doc,
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
import ContentViewModal from "./components/Contentviewmodal";
import ValidationPanel from "./components/ValidationPanel";
import ReviewerCard from "./components/ReviewerCard";

// Constants
import { STAGES } from "./constants";

// Styles
import "../../styles/workflow.css";

const Workflow = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { alertState, showAlert, dismissAlert } = useInPageAlert();
  const [highlightedContentId, setHighlightedContentId] = useState(null);
  const [viewingContent, setViewingContent] = useState(null);

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

  

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /* Aminah update: Highlight content when navigated from a notification or link */

  useEffect(() => {
    const targetId = location.state?.highlightContentId;
    if (!targetId) return;

    const frameId = window.requestAnimationFrame(() => {
      setHighlightedContentId(targetId);
    });
    const timer = window.setTimeout(() => {
      setHighlightedContentId(null);
    }, 5000);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timer);
    };
  }, [location.state?.highlightContentId, location.state?.notificationId]);

  useEffect(() => {
    fetchContent(selectedStage);
    setValidationResult(null);
    setShowValidationPanel(false);
    setShowFixesSummary(false);

    if (selectedStage === "Review" && user?.role === "admin") {
      fetchReviewers(user);
    }
  }, [
    selectedStage,
    user,
    fetchContent,
    fetchReviewers,
    setValidationResult,
    setShowValidationPanel,
    setShowFixesSummary,
  ]);

  useEffect(() => {
    const reviewerId = selectedContent?.reviewerId;
    fetchReviewerName(reviewerId);
  }, [selectedContent?.reviewerId, fetchReviewerName]);

  // ---- Wrapped handlers ----
  const handleValidate = async () => {
    const validation = await handleValidateContent(
      selectedContent,
      selectedTemplateId,
      showAlert,
    );

    if (validation?.brandScore >= 80) {
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
      //DRAVEN Sync updated validation into array
      setItems((prev) =>
        prev.map((item)=>
        item.id === selectedContent.id
          ? { ...item, validation }
          : item
        )
      );
      setSelectedContent((prev)=> prev ? { ...prev, validation } : prev);
      showAlert(
        "Content validated. Brand score is below 80. Apply fixes to improve and meet Review threshold.",
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
        // Keep items in sync so badges reflect latest score
        setItems((prev) =>
          prev.map((item) =>
            item.id === selectedContent.id
              ? { ...item, validation: revalidation }
              : item
          )
        );
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
    //DRAVEN Use freshest version from array
    const freshItem = items.find((i) => i.id === item.id) || item;

    setSelectedContent(freshItem);
    setSelectedReviewer(null);
    setValidationResult(freshItem.validation || null);
    setShowValidationPanel(!!freshItem.validation);
    if (freshItem.validatedTemplateId) {
      setSelectedTemplateId(freshItem.validatedTemplateId);
    }
    setShowFixesSummary(false);
  };

  const handleViewContent = (item) => {
    handleSelectContent(item);
    setViewingContent(item);
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
            onViewContent={handleViewContent}
            onStageChange={setSelectedStage}
            STAGES={STAGES}
            highlightedContentId={highlightedContentId}
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

      <ContentViewModal
        content={viewingContent}
        onClose={() => setViewingContent(null)}
      />
    </div>
  );
};

export default Workflow;
