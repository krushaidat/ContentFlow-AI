/**
 * useWorkflowContent Hook
 * Handles content fetching, auto-move logic, and content management
 */

import { useCallback, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../../../../firebase";

export const useWorkflowContent = () => {
  const [selectedStage, setSelectedStage] = useState("Draft");
  const [items, setItems] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-move validated items to Review
  const autoMoveValidatedItems = useCallback(async (itemsList) => {
    let itemsMoved = false;
    try {
      for (const item of itemsList) {
        if (item.validation?.brandScore >= 80 && item.stage === "Draft") {
          await updateDoc(doc(db, "content", item.id), {
            stage: "Review",
          });
          itemsMoved = true;
        }
      }
    } catch (err) {
      console.error("Error auto-moving validated items:", err);
    }
    return itemsMoved;
  }, []);

  // Fetch content for the selected stage
  const fetchContent = useCallback(
    async (stageToFetch) => {
      setLoading(true);
      setError("");

      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setError("User not authenticated.");
          setItems([]);
          return;
        }

        const q = query(
          collection(db, "content"),
          where("createdBy", "==", uid),
          where("stage", "==", stageToFetch),
          limit(50)
        );

        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        // Auto-move items with score >= 80 from Draft to Review
        if (stageToFetch === "Draft") {
          const itemsMoved = await autoMoveValidatedItems(results);
          if (itemsMoved) {
            const updatedSnapshot = await getDocs(q);
            const updatedResults = updatedSnapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
            setItems(updatedResults);

            if (updatedResults.length > 0) {
              setSelectedContent(updatedResults[0]);
            } else {
              setSelectedContent(null);
            }
          } else {
            setItems(results);
            if (!selectedContent || !results.find((r) => r.id === selectedContent.id)) {
              if (results.length > 0) {
                setSelectedContent(results[0]);
              } else {
                setSelectedContent(null);
              }
            }
          }
        } else {
          setItems(results);
          if (!selectedContent || !results.find((r) => r.id === selectedContent.id)) {
            if (results.length > 0) {
              setSelectedContent(results[0]);
            } else {
              setSelectedContent(null);
            }
          }
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedContent, autoMoveValidatedItems]
  );

  return {
    selectedStage,
    setSelectedStage,
    items,
    setItems,
    selectedContent,
    setSelectedContent,
    loading,
    error,
    fetchContent,
  };
};
