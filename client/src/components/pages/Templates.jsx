import React, { useCallback, useEffect, useState } from "react";
import { fetchTemplates, deleteTemplate } from "../../functions/templateDB";
import CreateTemplate from "../../functions/CreateTemplate";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../../firebase";
import "../styles/templatesPage.css";

export default function TemplatesPage() {

  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [sortBy, setSortBy] = useState("recent");

  const buildUsageMapFromContent = useCallback(async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser || await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (!currentUser) return {};

    const q = query(collection(db, "content"), where("createdBy", "==", currentUser.uid));
    const snapshot = await getDocs(q);

    const usageMap = {};
    snapshot.forEach((docSnapshot) => {
      const templateId = docSnapshot.data()?.templateId;
      if (!templateId) return;
      usageMap[templateId] = (usageMap[templateId] || 0) + 1;
    });

    return usageMap;
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const [templateData, usageMap] = await Promise.all([
        fetchTemplates(),
        buildUsageMapFromContent(),
      ]);

      // Keep popularity in sync with real content usage when loading the page
      const merged = templateData.map((template) => ({
        ...template,
        // Only trust current content usage to avoid stale historical counters.
        usageCount: Number(usageMap[template.id] ?? 0) || 0,
      }));

      setTemplates(merged);
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  }, [buildUsageMapFromContent]);

  // Aminah: Load templates when the component mounts


  // Aminah update: Set up real-time syncing with Firestore using onSnapshot

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "templates"),
      () => {
        loadTemplates();
      },
      (error) => {
        console.error("Failed to sync templates in real time:", error);
      },
    );

    loadTemplates();
    return unsubscribe;
  }, [loadTemplates]);

  const handleEditClick = (e, item) => {
    e.stopPropagation();
    setEditingTemplate(item);
    setIsCreateOpen(true);
  };

  // Aminah: Deletes a template and refreshes the list after deletion

  const handleDeleteClick = async (e, itemId) => {
    e.stopPropagation();
    try {
      await deleteTemplate(itemId);
      loadTemplates();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // Aminah: Opens the CreateTemplate modal in "create" mode when the "Create a Template" card is clicked

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsCreateOpen(true);
  };

  // Aminah: Filters templates based on the search query matching either the title or content (case-insensitive)

  const filteredTemplates = templates.filter(
    (t) =>
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.content?.toLowerCase().includes(search.toLowerCase())
  );

  // Helper to normalize possible timestamp formats (number, string, Firestore Timestamp)
  const toTimestamp = (val) => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    if (val?.toDate && typeof val.toDate === "function") {
      return val.toDate().getTime();
    }
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const compareByName = (a, b) => {
    return (a.title || "").localeCompare(b.title || "", undefined, {
      sensitivity: "base",
      numeric: true,
    });
  };

  const getTemplatePopularity = (template) => {
    return Number(template.usageCount ?? template.popularity ?? template.views ?? 0) || 0;
  };

  const getTemplateRecency = (template) => {
    return toTimestamp(
      template.updatedAt ||
      template.createdAt ||
      template.created_at ||
      template.lastModifiedAt ||
      template.lastModified ||
      0
    );
  };

  // Derive sorted list based on selected sort option
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (sortBy === "name") {
      return compareByName(a, b);
    }

    if (sortBy === "popular") {
      const popularityDiff = getTemplatePopularity(b) - getTemplatePopularity(a);
      if (popularityDiff !== 0) return popularityDiff;

      // Tie-breaker: newer template first, then alphabetical
      const recencyDiff = getTemplateRecency(b) - getTemplateRecency(a);
      if (recencyDiff !== 0) return recencyDiff;
      return compareByName(a, b);
    }

    if (sortBy === "oldest") {
      const recencyDiff = getTemplateRecency(a) - getTemplateRecency(b);
      if (recencyDiff !== 0) return recencyDiff;
      return compareByName(a, b);
    }

    // default: recent
    const recencyDiff = getTemplateRecency(b) - getTemplateRecency(a);
    if (recencyDiff !== 0) return recencyDiff;
    return compareByName(a, b);
  });

  
return (
    <div className="templates-page">
      <div className="templates-header">
        <h1>Guidelines</h1>
      </div>

      <div className="templates-toolbar">
        <div className="templates-search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            className="templates-search"
            placeholder="Search guidelines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="toolbar-right">
          <div className="templates-found">
            {filteredTemplates.length} {filteredTemplates.length === 1 ? "guideline" : "guidelines"} found
          </div>
          <select
            className="sort-dropdown"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort guidelines"
          >
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="popular">Most popular</option>
          </select>
        </div>
      </div>

      <div className="templates-list">
        {/* Updated Create Card */}
        <div className="template-create-card primary-accent" onClick={handleOpenCreate}>
          <div className="create-icon">+</div>
          <div className="create-content">
            <div className="create-title">Create a New Guideline</div>
            <div className="create-sub">Start from a blank slate or a blueprint.</div>
          </div>
        </div>

        {sortedTemplates.length === 0 ? (
          <div className="empty-state">No guidelines found.</div>
        ) : (
          sortedTemplates.map((item) => (
            <div key={item.id} className="template-card">
              <div className="card-body">
                <div className="template-title-row">
                  <div className="template-card-icon">
                    <span role="img" aria-label="Guideline icon">{item.icon || "📄"}</span>
                  </div>
                  <div className="template-title">{item.name || item.title}</div>
                </div>
                <div className="template-desc">{item.structure || item.content}</div>
              </div>

              {/* New Action Footer */}
              <div className="template-actions-footer">
                <button className="action-link edit" onClick={(e) => handleEditClick(e, item)} aria-label="Edit guideline" title="Edit">
                  <div className="action-icon-bg edit-bg">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </div>
                </button>
                <button className="action-link delete" onClick={(e) => handleDeleteClick(e, item.id)} aria-label="Delete guideline" title="Delete">
                  <div className="action-icon-bg delete-bg">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </div>
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