import React, { useState } from "react";
import "./styles/template.css";


// Aminah: I merged the TemplateModal code into this ManageTemplates component to avoid confusion. This component is now self-contained and can be used directly in the Dashboard. The TemplateModal component was removed since its functionality is now part of ManageTemplates.
// - I also updated the file name to ManageTemplates.jsx to reflect the component name and avoid confusion with Template.jsx, which is used for displaying individual templates in the content creation flow.
// This component manages the list of templates, allowing users to view, search, edit, and delete templates. It is designed to be used as a modal within the Dashboard page.
export default function ManageTemplates({ isOpen, onClose }) {
  const [templates, setTemplates] = useState([
    {
      id: "1",
      name: "Company Announcement",
      description: "Structure for announcing company news",
      lastModified: "Feb 5, 2026",
      icon: "📢",
    },
    {
      id: "2",
      name: "New Product",
      description: "Structure for detailing new product launches",
      lastModified: "Feb 9, 2026",
      icon: "🛒",
    },
    {
      id: "3",
      name: "Event Promotion",
      description: "Structure for promoting upcoming webinars, workshops, or events",
      lastModified: "Feb 3, 2026",
      icon: "🎫",
    },
    {
      id: "4",
      name: "Weekly Newsletter",
      description: "Outline for curating weekly newsletter content",
      lastModified: "Feb 2, 2026",
      icon: "📄",
    },
  ]);

  // Aminah: I added a search state to manage the search input for filtering templates. The filteredTemplates variable computes the list of templates that match the search query based on their name or description. The handleEdit and handleDelete functions are stubs for editing and deleting templates, which can be expanded with actual functionality later.
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  // Aminah: The handleEdit function currently just shows an alert with the template ID, but in a real application, it would likely open an edit form or navigate to an edit page. The handleDelete function updates the templates state by filtering out the deleted template based on its ID.
  const handleEdit = (id) => alert(`Edit template ${id}`);

  const handleDelete = (id) =>
    setTemplates(templates.filter((t) => t.id !== id));

  // Aminah: The component returns a modal overlay that contains the list of templates. It includes a search input for filtering templates and displays each template with its name, description, last modified date, and action buttons for editing and deleting. 
  // If no templates match the search query, it shows a message indicating that no templates were found.
  // The modal can be closed by clicking the close button or clicking outside the modal content area. The onClose function is called to handle closing the modal, which should be passed down from the parent component (Dashboard) that manages the state of whether the modal is open or not.
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Templates</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="templates-search-row">
          <input
            className="templates-search"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="templates-list">
          {filteredTemplates.length === 0 ? (
            <div style={{ padding: 24, color: "#6b7280" }}>
              No templates found.
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div key={template.id} className="template-card">
                <div className="template-card-icon">
                  {template.icon}
                </div>

                <div className="template-card-body">
                  <div className="template-card-title">
                    {template.name}
                  </div>
                  <div className="template-card-desc">
                    {template.description}
                  </div>
                  <div className="template-card-meta">
                    Last modified {template.lastModified}
                  </div>
                </div>

                <div className="template-card-actions">
                  <button onClick={() => handleEdit(template.id)}>
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
  );
}