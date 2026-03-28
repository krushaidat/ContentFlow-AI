import React, { useState } from "react";
import useInPageAlert from "../hooks/useInPageAlert";
import InPageAlert from "./InPageAlert";
import "./styles/template.css";

// Custom hook for templates state
const useTemplates = () => {
  const [templates, setTemplates] = useState([
    {
      id: '1',
      name: 'Company Announcement',
      description: 'Structure for announcing company news',
      lastModified: 'Feb 5, 2026',
      icon: "📢",
    },
    {
      id: '2',
      name: 'New Product',
      description: 'Structure for detailing new product launches',
      lastModified: 'Feb 4, 2026',
      icon: "🛒",
    },
    {
      id: '3',
      name: 'Event Promotion',
      description: 'Structure for promoting upcoming webinars, workshops, or events',
      lastModified: 'Feb 3, 2026',
      icon: "🎫",
    },
    {
      id: '4',
      name: 'Weekly Newsletter',
      description: 'Outline for curating weekly newsletter content',
      lastModified: 'Feb 2, 2026',
      icon: "📄",
    },
  ]);
  return { templates, setTemplates };
};

const TemplateModal = ({ isOpen, onClose }) => {
  const { templates, setTemplates } = useTemplates();
  const [search, setSearch] = useState("");
  const { alertState, showAlert, dismissAlert } = useInPageAlert();

  if (!isOpen) return null;

  // Filter templates by search
  const filteredTemplates = templates.filter(
    t => t.name.toLowerCase().includes(search.toLowerCase()) ||
         t.description.toLowerCase().includes(search.toLowerCase())
  );

  // Edit and delete handlers (stub)
  const handleEdit = (id) => showAlert(`Edit template ${id}`, "info");
  const handleDelete = (id) => setTemplates(templates.filter(t => t.id !== id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <InPageAlert alertState={alertState} onClose={dismissAlert} />
        <div className="modal-header">
          <h2>Templates</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="templates-search-row">
          <input
            className="templates-search"
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="templates-list">
          {filteredTemplates.length === 0 ? (
            <div style={{ padding: 24, color: '#6b7280', fontSize: 16 }}>No templates found.</div>
          ) : (
            filteredTemplates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-card-icon">{template.icon}</div>
                <div className="template-card-body">
                  <div className="template-card-title">{template.name}</div>
                  <div className="template-card-desc">{template.description}</div>
                  <div className="template-card-meta">Last modified {template.lastModified}</div>
                </div>
                <div className="template-card-actions">
                  <button onClick={() => handleEdit(template.id)}>Edit</button>
                  <button onClick={() => handleDelete(template.id)}>Delete</button>
                </div>
                <div className="template-card-date">{template.lastModified}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateModal;
export { useTemplates };

