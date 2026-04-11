/**
 * useReviewers Hook - Tanvir
 * Handles reviewer assignment and management
 */

import { useCallback, useState } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../../../../firebase";
import { API_BASE } from "../constants";
import { getAvailableReviewers } from "../../../../utils/geminiReviewerAssignment";
import { collection, query, getDocs } from "firebase/firestore";

export const useReviewers = () => {
  const [availableReviewers, setAvailableReviewers] = useState([]);
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [assigningReviewer, setAssigningReviewer] = useState(false);
  const [reviewerError, setReviewerError] = useState("");
  const [currentReviewerName, setCurrentReviewerName] = useState(null);

  const fetchReviewers = useCallback(async (user) => {
    if (!user?.uid || user?.role !== "admin") {
      setAvailableReviewers([]);
      return;
    }

    try {
      const reviewers = await getAvailableReviewers(
        db,
        collection,
        query,
        getDocs,
        user?.teamId || null
      );
      setAvailableReviewers(reviewers);
    } catch (err) {
      console.error("Error fetching reviewers:", err);
      setReviewerError("Failed to load reviewers");
    }
  }, []);

  const handleAssignReviewer = useCallback(async (
    user,
    selectedContent,
    reviewerId,
    showAlert
  ) => {
    if (
      !reviewerId ||
      !selectedContent ||
      !user?.uid ||
      user?.role !== "admin"
    ) {
      setReviewerError("Please select a reviewer");
      return;
    }

    setAssigningReviewer(true);
    setReviewerError("");

    try {
      const response = await fetch(`${API_BASE}/team/assign-reviewer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: user.uid,
          contentId: selectedContent.id,
          reviewerId,
          teamId: user.teamId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign reviewer");
      }

      const data = await response.json();
      showAlert(`Reviewer assigned: ${data.reviewerName}`, "success");

      return data;
    } catch (err) {
      console.error("Error assigning reviewer:", err);
      setReviewerError(err.message || "Failed to assign reviewer");
    } finally {
      setAssigningReviewer(false);
    }
  }, []);

  const fetchReviewerName = useCallback(async (reviewerId) => {
    if (!reviewerId) {
      setCurrentReviewerName(null);
      return;
    }

    try {
      const reviewerDoc = await getDoc(doc(db, "Users", reviewerId));
      if (reviewerDoc.exists()) {
        const rd = reviewerDoc.data();
        setCurrentReviewerName(
          rd.firstName && rd.lastName
            ? `${rd.firstName} ${rd.lastName}`
            : rd.name || rd.email || "Unknown"
        );
      } else {
        setCurrentReviewerName("Not Found");
      }
    } catch {
      setCurrentReviewerName("Unable to Load");
    }
  }, []);

  return {
    availableReviewers,
    selectedReviewer,
    setSelectedReviewer,
    assigningReviewer,
    reviewerError,
    currentReviewerName,
    fetchReviewers,
    handleAssignReviewer,
    fetchReviewerName,
  };
};
