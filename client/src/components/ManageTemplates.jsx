import React, { useEffect, useState } from "react";
import "./styles/ManageTemplates.css";
import { fetchTemplates, deleteTemplate } from "../functions/templateDB";
import CreateTemplate from "../functions/CreateTemplate";
import TemplateIcon from "./TemplateIcon";

// Aminah: I merged the TemplateModal code into this ManageTemplates component to avoid confusion. This component is now self-contained and can be used directly in the Dashboard. The TemplateModal component was removed since its functionality is now part of ManageTemplates.
// - I also updated the file name to ManageTemplates.jsx to reflect the component name and avoid confusion with Template.jsx, which is used for displaying individual templates in the content creation flow.
// This component manages the list of templates, allowing users to view, search, edit, and delete templates. It is designed to be used as a modal within the Dashboard page.
export default function ManageTemplates({ isOpen, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
    if (!isOpen) return undefined;

    // Defer loading so this doesn't run as a synchronous state update in the effect body.
    const timer = setTimeout(() => {
      loadTemplates();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen]);
    
  if (!isOpen) return null;

  const filteredTemplates = templates.filter(
  (t) =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.content?.toLowerCase().includes(search.toLowerCase())
  );


  // Aminah: The handleEdit function currently just shows an alert with the template ID, but in a real application, it would likely open an edit form or navigate to an edit page. The handleDelete function updates the templates state by filtering out the deleted template based on its ID.
  const handleEditClick = (e, item) => {
    e.stopPropagation();
    setEditingTemplate(item);
    setIsCreateOpen(true);
  };

  const handleDeleteClick = async (e, itemId) => {
    e.stopPropagation();
    try {
      await deleteTemplate(itemId);
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
                  setIsCreateOpen(true);
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
                    <div className="manage-template-card-icon">
                      <TemplateIcon
                        icon={template.icon}
                        iconType={template.iconType}
                        label="Template icon"
                        size={28}
                      />
                    </div>

                <div className="manage-template-card-body">
                  <div className="manage-template-card-title">
                    {template.title}
                  </div>
                  <div className="manage-template-card-desc">
                    {template.content}
                  </div>
                </div>

                <div className="manage-template-card-actions">
                  <button className="icon-btn edit" onClick={(e) => handleEditClick(e, template)} title="Edit">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button className="icon-btn delete" onClick={(e) => handleDeleteClick(e, template.id)} title="Delete">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
      isOpen={isCreateOpen}
      mode={editingTemplate ? "edit" : "create"}
      initialTemplate={editingTemplate}
      onClose={() => {
        setIsCreateOpen(false);
        setEditingTemplate(null);
      }}
      onSuccess={() => {
        setIsCreateOpen(false);
        setEditingTemplate(null);
        loadTemplates();
      }}
    />
  </>
  );
}