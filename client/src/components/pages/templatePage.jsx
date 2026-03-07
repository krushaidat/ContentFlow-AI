import React, { useEffect, useState } from "react";
import { fetchTemplates, deleteTemplate } from "../../functions/templateDB";
import CreateTemplate from "../../functions/CreateTemplate";
import "../styles/templatesPage.css";

// Aminah: This is the main Templates page component that displays a list of templates, allows users to search, create, edit, and delete templates. 

export default function TemplatesPage() {

  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Aminah: The loadTemplates function fetches the list of templates from the database and updates the templates state. 

  const loadTemplates = async () => {
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Aminah: The handleEditClick function is called when the edit button is clicked for a template. It sets the editingTemplate state to the selected template and opens the CreateTemplate modal in edit mode. 

  const handleEditClick = (e, item) => {
    e.stopPropagation();
    setEditingTemplate(item);
    setIsCreateOpen(true);
  };

  // Aminah: The handleDeleteClick function is called when the delete button is clicked for a template. It deletes the template from the database and reloads the templates list to reflect the changes.
  const handleDeleteClick = async (e, itemId) => {
    e.stopPropagation();
    try {
      await deleteTemplate(itemId);
      loadTemplates();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // Aminah: The handleOpenCreate function is called when the "Create Template" button is clicked. It resets the editingTemplate state and opens the CreateTemplate modal in create mode.
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsCreateOpen(true);
  };

  // Aminah: The filteredTemplates variable computes the list of templates that match the search query based on their title or content. This allows users to easily find specific templates by typing keywords in the search input.

  const filteredTemplates = templates.filter(
    (t) =>
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.content?.toLowerCase().includes(search.toLowerCase())
  );

  // Aminah: The return statement renders the Templates page UI, including the header, search input, list of templates, and the CreateTemplate modal. Each template card displays the template's icon, title, description, and action buttons for editing and deleting the template.

  return (
    <div className="templates-page">

      <div className="templates-header">
        <h1>Templates</h1>

        <button
          className="btn-submit"
          onClick={handleOpenCreate}
        >
          + Create Template
        </button>
      </div>

      <div className="templates-toolbar">
        <input
          className="templates-search"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="templates-list">
        {filteredTemplates.length === 0 ? (
          <div className="empty-state">No templates found.</div>
        ) : (
          filteredTemplates.map((item) => (
            <div key={item.id} className="template-card">

              <div className="template-card-icon">
                <span role="img" aria-label="Template icon">{item.icon || "📄"}</span>
              </div>

              <div className="template-card-body">
                <div className="template-title">{item.title}</div>
                <div className="template-desc">{item.structure || item.content}</div>
              </div>

              <div className="template-actions">
                <button className="icon-btn edit" onClick={(e) => handleEditClick(e, item)} title="Edit">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button className="icon-btn delete" onClick={(e) => handleDeleteClick(e, item.id)} title="Delete">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>

            </div>
          ))
        )}
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

    </div>
  );
}