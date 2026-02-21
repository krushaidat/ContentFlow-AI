import React, { useEffect, useRef, useState } from "react";
import "../styles/layout.css";
import userIcon from "../../assets/user.png";
import { useNavigate } from "react-router-dom";

/**
 * TOPBAR COMPONENT (Updated by Tanvir)
 - Displays user's first name in welcome message
 - Extracts first name from full name string if needed
 - Shows user greeting and dashboard info
 */
const Topbar = ({
  displayName,
  title = "Dashboard",
  subtitle = "Automated content workflow overview",
  onLogout,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();


  // TANVIR: Helper function to ensure we only display first name
  // Splits on space to get first name from "FirstName LastName" format
  const getFirstName = (name) => {
    if (!name) return title;
    return name.split(/\s+/)[0];
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleSignOut = () => {
    setOpen(false);
    if (typeof onLogout === "function") onLogout();
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* TANVIR: Display welcome message with extracted first name only */}
        <h2>{displayName ? `Welcome, ${getFirstName(displayName)}` : title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="topbar-right" ref={ref}>
        <button
          className="avatar-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
        >
          <div className="user-avatar">
            <img src={userIcon} alt="User profile" />
          </div>
        </button>

        {open && (
          <div className="avatar-menu" role="menu">
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate("/profile");
              }}
            >
              Profile
            </button>

            <button className="menu-item" role="menuitem">
              Settings
            </button>
            <div className="menu-divider" />
            <button
              className="menu-item danger"
              role="menuitem"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
