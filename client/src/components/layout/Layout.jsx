import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "../styles/layout.css";
const Layout = ({ children, onLogout, displayName }) => {
  // Abdalaa: this controls the burger sidebar on smaller screens.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="app-layout">
      {/* Abdalaa: dark overlay behind the mobile sidebar */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
  
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
  
      <div className="main-area">
        {/* Abdalaa: burger button only matters on mobile/tablet sizes */}
        <button
          className="burger-btn"
          type="button"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
  
        <Topbar onLogout={onLogout} displayName={displayName} />
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
};

export default Layout;