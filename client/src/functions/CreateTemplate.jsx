/**
 * CreateTemplate — Guideline Builder
 * Authors: Aminah (original), Tanvir (guideline fields upgrade)
 */

import React, { useEffect, useState } from "react";
import { collection, addDoc, setDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const CreateTemplate = ({
  isOpen,
  onClose,
  onSuccess,
  existingTemplate = null,
  mode = "create",
  initialTemplate = null,
}) => {
  const templateToEdit = initialTemplate || existingTemplate;
  const isEditMode = mode === "edit" || Boolean(templateToEdit?.id);

  // Form fields
  const [name, setName] = useState("");
  const [requiredSections, setRequiredSections] = useState("");
  const [toneRules, setToneRules] = useState("");
  const [structuralRules, setStructuralRules] = useState("");
  const [languageConstraints, setLanguageConstraints] = useState("");
  const [description, setDescription] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showPasteMode, setShowPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // Populate fields on open / edit
  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode && templateToEdit) {
      setName(templateToEdit.name || templateToEdit.title || "");

      // requiredSections may be a string or array
      const sections = templateToEdit.requiredSections;
      if (Array.isArray(sections)) {
        setRequiredSections(sections.filter(Boolean).join(", "));
      } else if (typeof sections === "string") {
        // Normalise "Hook: CTA:" format into "Hook, CTA"
        setRequiredSections(
          sections
            .split(/[:,\n]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(", ")
        );
      } else {
        setRequiredSections("");
      }

      setToneRules(templateToEdit.toneRules || "");
      setStructuralRules(
        templateToEdit.structuralRules || templateToEdit.structure || ""
      );
      setLanguageConstraints(templateToEdit.languageConstraints || "");
      setDescription(
        templateToEdit.content ||
          templateToEdit.structure ||
          templateToEdit.description ||
          ""
      );
    } else {
      resetFields();
    }

    setError(null);
    setSuccess(false);
    setShowPasteMode(false);
    setPasteText("");
  }, [isOpen, isEditMode, templateToEdit]);

  const resetFields = () => {
    setName("");
    setRequiredSections("");
    setToneRules("");
    setStructuralRules("");
    setLanguageConstraints("");
    setDescription("");
  };

  // Convert comma-separated string to clean array
  const parseSections = (raw) =>
    raw
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  // Handle "Paste Full Guideline" — auto-fills description
  const handlePasteApply = () => {
    if (pasteText.trim()) {
      setDescription(pasteText.trim());
    }
    setShowPasteMode(false);
    setPasteText("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Template name is required.");
      return;
    }

    const sectionsArray = parseSections(requiredSections);

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();

      const payload = {
        // Canonical field names the AI controller reads
        name: trimmedName,
        title: trimmedName, // backwards compat
        requiredSections: sectionsArray,
        toneRules: toneRules.trim(),
        structuralRules: structuralRules.trim(),
        languageConstraints: languageConstraints.trim(),
        content: description.trim(),
        structure: description.trim(), // backwards compat
        icon: "📄",
        lastModified: new Date().toLocaleDateString(),
        lastModifiedAt: nowIso,
        updatedAt: nowIso,
      };

      if (isEditMode && templateToEdit?.id) {
        const existingCreatedAt =
          templateToEdit.createdAt || templateToEdit.created_at || nowIso;
        await updateDoc(doc(db, "templates", templateToEdit.id), {
          ...payload,
          createdAt: existingCreatedAt,
        });
      } else {
        await setDoc(doc(db, "templates", trimmedName), {
          ...payload,
          createdAt: nowIso,
          usageCount: 0,
        });
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error("Error saving template:", err);
      setError(
        isEditMode
          ? "Failed to update template. Please try again."
          : "Failed to create template. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetFields();
    setError(null);
    setSuccess(false);
    setShowPasteMode(false);
    setPasteText("");
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640 }}
      >
        <div className="modal-header">
          <h2>{isEditMode ? "Edit Guideline" : "Create New Guideline"}</h2>
          <button
            className="modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {success ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ marginBottom: 8, color: "#111827" }}>
              {isEditMode ? "Guideline Updated!" : "Guideline Created!"}
            </h3>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>
              <strong>{name}</strong> has been saved and is now available for AI
              validation.
            </p>
            <button className="btn-submit" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-content-form">
            {/* Template Name */}
            <div className="form-group">
              <label htmlFor="tpl-name">Guideline Name *</label>
              <input
                id="tpl-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Product Launch", "Blog Post", "Social Media"'
                disabled={loading}
              />
            </div>

            {/* Required Sections */}
            <div className="form-group">
              <label htmlFor="tpl-sections">
                Required Sections{" "}
                <span style={{ fontWeight: 400, color: "#6b7280" }}>
                  (comma-separated)
                </span>
              </label>
              <input
                id="tpl-sections"
                type="text"
                value={requiredSections}
                onChange={(e) => setRequiredSections(e.target.value)}
                placeholder="Hook, Product Description, Key Benefits, Call To Action"
                disabled={loading}
              />
              <small style={{ color: "#9ca3af", fontSize: 11 }}>
                AI will check that each section appears in the content.
              </small>
            </div>

            {/* Tone Rules */}
            <div className="form-group">
              <label htmlFor="tpl-tone">Tone Rules</label>
              <textarea
                id="tpl-tone"
                value={toneRules}
                onChange={(e) => setToneRules(e.target.value)}
                placeholder="e.g. Professional, confident, exciting. Avoid slang or overly casual language."
                rows="2"
                style={{ background: "#fff", color: "#000" }}
                disabled={loading}
              />
            </div>

            {/* Structural Rules */}
            <div className="form-group">
              <label htmlFor="tpl-structure">Structural Rules</label>
              <textarea
                id="tpl-structure"
                value={structuralRules}
                onChange={(e) => setStructuralRules(e.target.value)}
                placeholder="e.g. Must include a strong opening hook. CTA must contain urgency wording like 'Sign up now'."
                rows="2"
                style={{ background: "#fff", color: "#000" }}
                disabled={loading}
              />
            </div>

            {/* Language Constraints */}
            <div className="form-group">
              <label htmlFor="tpl-lang">Language Constraints</label>
              <textarea
                id="tpl-lang"
                value={languageConstraints}
                onChange={(e) => setLanguageConstraints(e.target.value)}
                placeholder="e.g. No excessive emojis. No all-caps sentences. Keep under 500 words."
                rows="2"
                style={{ background: "#fff", color: "#000" }}
                disabled={loading}
              />
            </div>

            {/* Description / Full Guideline */}
            <div className="form-group">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label htmlFor="tpl-desc">
                  Description / Full Guideline
                </label>
                <button
                  type="button"
                  onClick={() => setShowPasteMode(!showPasteMode)}
                  style={{
                    background: "none",
                    border: "1px solid rgba(124,58,237,0.25)",
                    color: "#7c3aed",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  {showPasteMode ? "Cancel" : "📋 Paste Full Guideline"}
                </button>
              </div>

              {showPasteMode ? (
                <div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your full brand guideline document here…"
                    rows="6"
                    style={{
                      background: "#fff",
                      color: "#000",
                      width: "100%",
                      marginBottom: 8,
                    }}
                  />
                  <button
                    type="button"
                    className="btn-submit"
                    onClick={handlePasteApply}
                    style={{ fontSize: 13, padding: "6px 14px" }}
                  >
                    Apply to Description
                  </button>
                </div>
              ) : (
                <textarea
                  id="tpl-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this guideline and any additional rules…"
                  rows="4"
                  style={{ background: "#fff", color: "#000" }}
                  disabled={loading}
                />
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading
                  ? isEditMode
                    ? "Saving..."
                    : "Creating..."
                  : isEditMode
                    ? "Save Changes"
                    : "Create Guideline"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateTemplate;