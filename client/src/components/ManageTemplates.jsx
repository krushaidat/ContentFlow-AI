import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import "./styles/template.css";
import { fetchTemplates, deleteTemplate } from "../functions/templateDB";
import CreateTemplate from "../functions/CreateTemplate";

// Aminah: I merged the TemplateModal code into this ManageTemplates component to avoid confusion. This component is now self-contained and can be used directly in the Dashboard. The TemplateModal component was removed since its functionality is now part of ManageTemplates.
// - I also updated the file name to ManageTemplates.jsx to reflect the component name and avoid confusion with Template.jsx, which is used for displaying individual templates in the content creation flow.
// This component manages the list of templates, allowing users to view, search, edit, and delete templates. It is designed to be used as a modal within the Dashboard page.
export default function ManageTemplates({ isOpen, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const loadTemplates = async () => {
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(
    (t) =>
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.sections?.toLowerCase().includes(search.toLowerCase())
  );

  // DRAVEN: Opens the CreateTemplate modal with the selected template's data for editing. The onSuccess callback is used to refresh the template list after a template is created or updated. The existingTemplate prop is passed to pre-fill the form when editing an existing template.
  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteTemplate(id);
      loadTemplates();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Templates</h2>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                className="btn-submit"
                onClick={() => {
                  setEditingTemplate(null);
                  setShowCreateModal(true);
                }}
              >
                + Create Template
              </button>
              <button className="modal-close" onClick={onClose}>
                ×
              </button>
            </div>
          </div>

          <div className="modal-scroll">
            <div className="manage-templates-search-row">
              <input
                className="manage-templates-search"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="manage-templates-list">
              {filteredTemplates.length === 0 ? (
                <div style={{ padding: 24, color: "#6b7280" }}>
                  No templates found.
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <div key={template.id} className="manage-template-card">
                    <div className="manage-template-card-icon" />

                    <div className="manage-template-card-body">
                      <div className="manage-template-card-title">
                        {template.title}
                      </div>
                      <div className="manage-template-card-desc">
                        {template.content}
                      </div>
                    </div>

                    <div className="manage-template-card-actions">
                      <button onClick={() => handleEdit(template)}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(template.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateTemplate
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTemplate(null);
        }}
        existingTemplate={editingTemplate}
        onSuccess={() => {
          setShowCreateModal(false);
          setEditingTemplate(null);
          loadTemplates();
        }}
      />
    </>
  );
}