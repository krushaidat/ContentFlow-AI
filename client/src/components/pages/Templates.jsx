import React, { useEffect, useState } from "react";
import { fetchTemplates, deleteTemplate } from "../../functions/templateDB";
import CreateTemplate from "../../functions/CreateTemplate";
import "../styles/templatesPage.css";

export default function TemplatesPage() {

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
    loadTemplates();
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteTemplate(id);
      loadTemplates();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setIsCreateOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsCreateOpen(true);
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.content?.toLowerCase().includes(search.toLowerCase())
  );

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
          filteredTemplates.map((template) => (
            <div key={template.id} className="template-card">

              <div className="template-card-body">
                <div className="template-title">{template.title}</div>
                <div className="template-desc">{template.content}</div>
              </div>

              <div className="template-actions">
                <button onClick={() => handleEdit(template)}>Edit</button>
                <button onClick={() => handleDelete(template.id)}>
                  Delete
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