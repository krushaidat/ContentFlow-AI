import React, { useEffect, useRef, useState } from "react";
import "../styles/layout.css";
import userIcon from "../../assets/user.png";
import { useNavigate } from "react-router-dom";

/* Updated by Aminah: 
 I added a set of sample notifications to populate the notifications panel in the topbar. 
 Each notification includes an id, title, message, time label, and read status. 
 This allows us to show how the notifications system works in the UI, including unread counts and message truncation.
*/
const initialNotifications = [
  {
    id: "notif-project-brief",
    title: "Review complete: Project Brief",
    message:
      "Draven Wilson completed the review for Project Brief. The draft is assigned back to you for final polish.",
    timeLabel: "2m ago",
    read: false,
  },
  {
    id: "notif-blog-1",
    title: "Draven assigned to Blog Post 1",
    message:
      "Blog Post 1 has been assigned to Draven Wilson for review. You will be notified once feedback is ready.",
    timeLabel: "18m ago",
    read: false,
  },
  {
    id: "notif-blog-2",
    title: "Draven assigned to Blog Post 2",
    message:
      "Blog Post 2 is now in the review queue. Collaboration is active and status updates will appear here.",
    timeLabel: "1h ago",
    read: true,
  },
  {
    id: "notif-calendar",
    title: "Calendar reminder: Editorial sync",
    message:
      "Your editorial sync starts at 3:00 PM today. Review the latest content schedule before the meeting.",
    timeLabel: "3h ago",
    read: true,
  },
];

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
  // Aminah: State for managing active menu, notifications, and selected notification
  const [activeMenu, setActiveMenu] = useState(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [expandedNotificationId, setExpandedNotificationId] = useState(null);
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
      // Aminah: Close any open menu if click is outside of the topbar area
      if (ref.current && !ref.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleSignOut = () => {
    setActiveMenu(null);
    if (typeof onLogout === "function") onLogout();
  };

  /* Updated by Aminah:
   - Added function to truncate long notification messages for better display in the panel
   - Messages longer than 86 characters will be shortened with an ellipsis
   - This keeps the UI clean while allowing users to expand for full details if needed
  */

  const truncateMessage = (text, maxLength = 86) => {
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  // Aminah: Calculate unread notifications count for badge display

  const unreadCount = notifications.filter((item) => !item.read).length;
  // Aminah: Toggle function to open/close notifications and profile menus
  const toggleMenu = (menuName) => {
    setActiveMenu((current) => (current === menuName ? null : menuName));
  };
  // Aminah: Handle notification selection, mark as read, and update state
  const handleNotificationSelect = (notificationId) => {
    setExpandedNotificationId((current) =>
      current === notificationId ? null : notificationId
    );
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item
      )
    );
  };
  //
  const handleMarkAllAsRead = () => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true }))
    );
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
          className="topbar-icon-btn"
          type="button"
          aria-label="Open notifications"
          aria-haspopup="dialog"
          aria-expanded={activeMenu === "notifications"}
          onClick={() => toggleMenu("notifications")}
        >
          <span className="topbar-icon-shell" aria-hidden="true">
            <svg
              className="topbar-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18h5l-1.4-1.4A2 2 0 0 1 18 15.2V11a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 18h5" />
              <path d="M10 18a2 2 0 0 0 4 0" />
            </svg>
          </span>
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </button>

        {activeMenu === "notifications" && (
          <div className="notifications-panel" role="dialog" aria-label="Notifications">
            <div className="notifications-header">
              <div>
                <h3>My Notifications</h3>
                <p>{unreadCount > 0 ? `${unreadCount} unread updates` : "All caught up"}</p>
              </div>
              <button
                type="button"
                className="mark-all-read"
                onClick={handleMarkAllAsRead}
              >
                Mark all as read
              </button>
            </div>

            <div className="notification-list" role="list">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notification-item${item.id === expandedNotificationId ? " active" : ""}${item.read ? "" : " unread"}`}
                  aria-expanded={item.id === expandedNotificationId}
                  onClick={() => handleNotificationSelect(item.id)}
                >
                  <span className="notification-item-dot" aria-hidden="true" />
                  <span className="notification-item-copy">
                    <strong>{item.title}</strong>
                    <span>{truncateMessage(item.message)}</span>
                    {item.id === expandedNotificationId && (
                      <span className="notification-item-message">{item.message}</span>
                    )}
                  </span>
                  <span className="notification-time">{item.timeLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="avatar-btn"
          type="button"
          aria-haspopup="menu"
          aria-expanded={activeMenu === "profile"}
          onClick={() => toggleMenu("profile")}
        >
          <div className="user-avatar">
            <img src={userIcon} alt="User profile" />
          </div>
        </button>

        {activeMenu === "profile" && (
          <div className="avatar-menu" role="menu">
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setActiveMenu(null);
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
