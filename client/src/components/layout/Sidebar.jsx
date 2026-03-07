import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/layout.css";
import dashboardIcon from "../../assets/dashboard.png";
import workflowIcon from "../../assets/Workflow.png";
import templatesIcon from "../../assets/templates.png";
import toolsIcon from "../../assets/tools.png";
import projectsIcon from "../../assets/projects.png";
import settingIcon from "../../assets/setting.png";
import helpIcon from "../../assets/help.png";
import teamIcon from "../../assets/teams.png";
import { useAuth } from "../../hooks/useAuth.js"; 

const routes = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "workflow", label: "Workflow", path: "/workflow" },
  { key: "templates", label: "Templates", path: "/templates" },
  { key: "calendar", label: "Calendar", path: "/calendar" },
  { key: "review", label: "Review", path: "/review", reviewerOnly: true },
  { key: "team", label: "Team", path: "/team" }
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); // <-- Get user

  const getActiveKey = () => {
    const path = location.pathname;
    return routes.find(r => r.path === path)?.key || "dashboard";
  };

  const [active, setActive] = useState(getActiveKey());

  React.useEffect(() => {
    setActive(getActiveKey());
  }, [location.pathname]);

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-title">ContentFlow AI</div>
      </div>

      <nav className="sidebar-nav">
        {routes
          .filter(r => !r.reviewerOnly || user?.role === "reviewer") // <-- Only show Review for reviewers
          .map((r) => {
            const labelKey = r.label.toLowerCase();
            let icon = null;
            if (labelKey.includes("dash")) icon = dashboardIcon;
            else if (labelKey.includes("work")) icon = workflowIcon;
            else if (labelKey.includes("templates")) icon = templatesIcon;
            else if (labelKey.includes("calendar")) icon = toolsIcon;
            else if (labelKey.includes("review")) icon = projectsIcon;
            else if (labelKey.includes("team")) icon = teamIcon;

            return (
              <button
                key={r.key}
                className={`nav-item ${active === r.key ? "active" : ""}`}
                onClick={() => handleNavigate(r.path)}
              >
                {icon ? <img src={icon} alt="" className="nav-icon-img nav-icon-small" /> : <span className="nav-icon" aria-hidden />}
                <span className="nav-label">{r.label}</span>
              </button>
            );
          })}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-actions">
          <button className="action-item" onClick={() => handleNavigate('/settings')}>
            <img src={settingIcon} alt="settings" style={{width:16,height:16,marginRight:8}} />
            Settings
          </button>
          <button className="action-item" onClick={() => handleNavigate('/help')}>
            <img src={helpIcon} alt="help" style={{width:16,height:16,marginRight:8}} />
            Help
          </button>
        </div>

        <div className="analytics-card">
          <div className="analytics-title">Analytics Overview</div>
          <div className="analytics-stats">
            <div className="stat">
              <div className="stat-label">Monthly Views</div>
              <div className="stat-value">12.4K</div>
            </div>
            <div className="stat">
              <div className="stat-label">Engagement Rate</div>
              <div className="stat-value">6.8%</div>
            </div>
          </div>
          <div className="sparkline" aria-hidden>
            <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
              <polyline points="0,30 20,24 40,18 60,22 80,14 100,20" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
