import React, { useEffect, useState } from "react";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import TemplateIcon, {
  TEMPLATE_BRAND_FACEBOOK,
  TEMPLATE_BRAND_INSTAGRAM,
  TEMPLATE_BRAND_LINKEDIN,
  TEMPLATE_ICON_TYPE_BRAND,
  TEMPLATE_ICON_TYPE_EMOJI,
} from "../components/TemplateIcon";

/* Aminah: The CreateTemplate component is a modal form that allows users to create or edit templates. 
It manages its own state for the template fields and handles form submission to either add a new template or update an existing one in the Firestore database. 
The component also includes error handling and success feedback to enhance the user experience when managing templates. It uses the TemplateIcon component to allow users to select an icon for their template, which can be either a custom emoji or a predefined brand icon. The form includes fields for the template title, required sections, and structure, providing flexibility for users to define their templates as needed.
*/

const TEMPLATE_ICON_OPTIONS = [
  { value: "📄", label: "Document" },
  { value: "📢", label: "Announcement" },
  { value: "🛒", label: "Product" },
  { value: "🎫", label: "Event" },
  { value: "📰", label: "Newsletter" },
  { value: "📣", label: "Campaign" },
  { value: "💼", label: "Business" },
  { value: "📊", label: "Report" },
  { value: "📱", label: "Social" },
  { value: "🎯", label: "Goal" },
  { value: "🚀", label: "Launch" },
  { value: "✨", label: "Highlight" },
];

/* Aminah: The TEMPLATE_ICON_OPTIONS array defines a set of predefined icons that users can choose from when creating or editing a template.
 Each option includes a value (the emoji character) and a label for display in the dropdown menu.
 This allows users to easily select an appropriate icon for their template, enhancing the visual organization and recognition of templates within the application.
*/

const CUSTOM_ICON_OPTION = "__custom_emoji__";
const BRAND_LINKEDIN_OPTION = "__brand_linkedin__";
const BRAND_FACEBOOK_OPTION = "__brand_facebook__";
const BRAND_INSTAGRAM_OPTION = "__brand_instagram__";

const TEMPLATE_ICON_VALUES = new Set(TEMPLATE_ICON_OPTIONS.map((option) => option.value));

const BRAND_ALIASES = {
  linkedin: TEMPLATE_BRAND_LINKEDIN,
  "linked in": TEMPLATE_BRAND_LINKEDIN,
  li: TEMPLATE_BRAND_LINKEDIN,
  facebook: TEMPLATE_BRAND_FACEBOOK,
  fb: TEMPLATE_BRAND_FACEBOOK,
  instagram: TEMPLATE_BRAND_INSTAGRAM,
  insta: TEMPLATE_BRAND_INSTAGRAM,
  ig: TEMPLATE_BRAND_INSTAGRAM,
};

// Aminah: The normalizeBrandAlias function takes a string input and normalizes it to match one of the predefined brand icons if it corresponds to a known alias. 

const normalizeBrandAlias = (value = "") => {
  const normalized = value.trim().toLowerCase();
  return BRAND_ALIASES[normalized] || null;
};

// Aminah: The normalizeTemplateIconPayload function takes the selected icon value and an optional custom value, and returns a normalized payload that includes the icon and its type (brand or emoji). It checks if the selected value corresponds to a predefined brand option or a custom emoji, and formats the payload accordingly for storage in the database.

const normalizeTemplateIconPayload = (value, customValue = "") => {
  if (value === BRAND_LINKEDIN_OPTION) {
    return {
      icon: TEMPLATE_BRAND_LINKEDIN,
      iconType: TEMPLATE_ICON_TYPE_BRAND,
    };
  }

  if (value === BRAND_FACEBOOK_OPTION) {
    return {
      icon: TEMPLATE_BRAND_FACEBOOK,
      iconType: TEMPLATE_ICON_TYPE_BRAND,
    };
  }

  if (value === BRAND_INSTAGRAM_OPTION) {
    return {
      icon: TEMPLATE_BRAND_INSTAGRAM,
      iconType: TEMPLATE_ICON_TYPE_BRAND,
    };
  }

  if (value === CUSTOM_ICON_OPTION) {
    const trimmedCustom = customValue.trim();

    const matchedBrand = normalizeBrandAlias(trimmedCustom);
    if (matchedBrand) {
      return {
        icon: matchedBrand,
        iconType: TEMPLATE_ICON_TYPE_BRAND,
      };
    }

    return {
      icon: trimmedCustom || "📄",
      iconType: TEMPLATE_ICON_TYPE_EMOJI,
    };
  }

  if (TEMPLATE_ICON_VALUES.has(value)) {
    return {
      icon: value,
      iconType: TEMPLATE_ICON_TYPE_EMOJI,
    };
  }

  return {
    icon: "📄",
    iconType: TEMPLATE_ICON_TYPE_EMOJI,
  };
};

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

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📄");
  const [customIcon, setCustomIcon] = useState("");
  const [requiredSections, setRequiredSections] = useState("");
  const [structure, setStructure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    /* Aminah: When the modal opens, if it's in edit mode and a template to edit is provided, it populates the form fields with the existing template data. 
       It also determines the correct icon selection based on whether the existing icon is a predefined brand, a custom emoji, or a non-empty string. 
    // If not in edit mode, it resets all fields to their default values for creating a new template.
    */

    if (isEditMode && templateToEdit) {
      setTitle(templateToEdit.title || "");
      const existingIcon = templateToEdit.icon || "📄";
      const existingIconType = templateToEdit.iconType || TEMPLATE_ICON_TYPE_EMOJI;

      if (
        existingIconType === TEMPLATE_ICON_TYPE_BRAND &&
        existingIcon === TEMPLATE_BRAND_LINKEDIN
      ) {
        setIcon(BRAND_LINKEDIN_OPTION);
        setCustomIcon("");
      } else if (
        existingIconType === TEMPLATE_ICON_TYPE_BRAND &&
        existingIcon === TEMPLATE_BRAND_FACEBOOK
      ) {
        setIcon(BRAND_FACEBOOK_OPTION);
        setCustomIcon("");
      } else if (
        existingIconType === TEMPLATE_ICON_TYPE_BRAND &&
        existingIcon === TEMPLATE_BRAND_INSTAGRAM
      ) {
        setIcon(BRAND_INSTAGRAM_OPTION);
        setCustomIcon("");
      } else if (TEMPLATE_ICON_VALUES.has(existingIcon)) {
        setIcon(existingIcon);
        setCustomIcon("");
      } else {
        setIcon(CUSTOM_ICON_OPTION);
        setCustomIcon(existingIcon);
      }
      setRequiredSections(templateToEdit.requiredSections || "");
      setStructure(templateToEdit.structure || templateToEdit.content || "");
    } else {
      setTitle("");
      setIcon("📄");
      setCustomIcon("");
      setRequiredSections("");
      setStructure("");
    }

    setError(null);
    setSuccess(false);
  }, [isOpen, isEditMode, templateToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      setError("Please sign in again and try creating a template.");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedSections = requiredSections.trim();
    const trimmedStructure = structure.trim();
    const selectedIconPayload = normalizeTemplateIconPayload(icon, customIcon);

    if (!trimmedTitle || !trimmedSections || !trimmedStructure) {
      setError("Please fill in all fields.");
      return;
    }

    if (icon === CUSTOM_ICON_OPTION && !customIcon.trim()) {
      setError("Please enter a custom emoji or brand name.");
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const existingCreatedAt =
        templateToEdit?.createdAt || templateToEdit?.created_at || nowIso;

      const payload = {
        title: trimmedTitle,
        requiredSections: trimmedSections,
        structure: trimmedStructure,
        content: trimmedStructure,
        icon: selectedIconPayload.icon,
        iconType: selectedIconPayload.iconType,
        createdBy: templateToEdit?.createdBy || currentUser.uid,
        lastModified: new Date().toLocaleDateString(),
        lastModifiedAt: nowIso,
        updatedAt: nowIso,
      };

      if (isEditMode && templateToEdit?.id) {
        await updateDoc(doc(db, "templates", templateToEdit.id), {
          ...payload,
          createdAt: existingCreatedAt,
        });
      } else {
        await addDoc(collection(db, "templates"), {
          ...payload,
          createdAt: nowIso,
          usageCount: 0,
        });
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error("Error saving template:", err);

      const rawCode = typeof err?.code === "string" ? err.code : "";
      const compactCode = rawCode.replace("firestore/", "").trim();
      const codeSuffix = compactCode ? ` (${compactCode})` : "";

      setError(
        isEditMode
          ? `Failed to update template. Please try again.${codeSuffix}`
          : `Failed to create template. Please try again.${codeSuffix}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setIcon("📄");
    setCustomIcon("");
    setRequiredSections("");
    setStructure("");
    setError(null);
    setSuccess(false);
    onClose?.();
  };

  if (!isOpen) return null;

  const previewIconPayload = normalizeTemplateIconPayload(icon, customIcon);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? "Edit Template" : "Create New Template"}</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">
            ×
          </button>
        </div>

        {success ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ marginBottom: 8, color: "#111827" }}>
              {isEditMode ? "Template Updated!" : "Template Created!"}
            </h3>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>
              Your template <strong>{title}</strong> has been saved successfully.
            </p>
            <button className="btn-submit" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-content-form">
            <div className="form-group">
              <label htmlFor="template-title">Title</label>
              <input
                id="template-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter template title"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="template-icon">Icon</label>
              <select
                id="template-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                disabled={loading}
              >
                {TEMPLATE_ICON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value} {option.label}
                  </option>
                ))}
                <option value={BRAND_LINKEDIN_OPTION}>LinkedIn logo</option>
                <option value={BRAND_FACEBOOK_OPTION}>Facebook logo</option>
                <option value={BRAND_INSTAGRAM_OPTION}>Instagram logo</option>
                <option value={CUSTOM_ICON_OPTION}>Custom emoji...</option>
              </select>

              {icon === CUSTOM_ICON_OPTION && (
                <input
                  type="text"
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  placeholder="Type emoji or brand name (instagram, facebook, linkedin)"
                  maxLength={12}
                  disabled={loading}
                />
              )}

              <div style={{ fontSize: 14, color: "#4b5563" }}>
                Preview:{" "}
                <span style={{ display: "inline-flex", verticalAlign: "middle" }}>
                  <TemplateIcon
                    icon={previewIconPayload.icon}
                    iconType={previewIconPayload.iconType}
                    label="Selected template icon"
                    size={22}
                  />
                </span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="template-sections">Sections</label>
              <textarea
                id="template-sections"
                value={requiredSections}
                onChange={(e) => setRequiredSections(e.target.value)}
                placeholder="Enter template sections (e.g. Introduction, Body, Conclusion)"
                rows="4"
                style={{ background: "#fff", color: "#000" }}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="template-structure">Structure</label>
              <textarea
                id="template-structure"
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                placeholder="Describe the structure of this template"
                rows="4"
                style={{ background: "#fff", color: "#000" }}
                disabled={loading}
              />
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
                  : "Create Template"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateTemplate;