/**
 * useTemplates Hook- Tanvir
 * Handles template fetching from the API
 */

import { useCallback, useState } from "react";
import { API_BASE } from "../constants";

export const useTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/templates`);
      const data = await res.json();
      setTemplates(data);

      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, [selectedTemplateId]);

  return {
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    fetchTemplates,
  };
};
