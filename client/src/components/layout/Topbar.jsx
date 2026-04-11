import React, { useEffect, useRef, useState } from "react";
import "../styles/layout.css";
import userIcon from "../../assets/user.png";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";

/* Updated by Aminah:
 - Added real-time notifications panel with Firestore integration
 - Displays user's first name in welcome message
 - Shows notification badge with unread count
 - Allows marking notifications as read and navigating to related content
 - Improved accessibility with ARIA attributes and keyboard navigation support
*/

const NOTIFICATIONS_LIMIT = 30;

const toMillis = (value) => {
  if (!value) return Date.now();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const formatRelativeTime = (input) => {
  const ms = toMillis(input);
  const diffSeconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

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
  const { user } = useAuth();
  // Aminah: State for managing active menu, notifications, and selected notification
  const [activeMenu, setActiveMenu] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState(null);
  const [expandedNotificationId, setExpandedNotificationId] = useState(null);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState([]);
  const [undoPayload, setUndoPayload] = useState(null);
  const ref = useRef(null);
  const undoTimerRef = useRef(null);
  const selectAllRef = useRef(null);
  const navigate = useNavigate();
  const visibleNotifications = user?.uid ? notifications : [];
  const visibleNotificationsError = user?.uid ? notificationsError : null;


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

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const notificationsRef = collection(db, "Users", user.uid, "notifications");
    const notificationsQuery = query(
      notificationsRef,
      orderBy("createdAt", "desc"),
      limit(NOTIFICATIONS_LIMIT)
    );

    // Aminah: Set up real-time listener for user's notifications
    // Updates notifications state whenever there's a change in the Firestore collection

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const next = snapshot.docs
          .filter((notificationDoc) => !notificationDoc.data().deleted)
          .map((notificationDoc) => {
          const data = notificationDoc.data();
          return {
            id: notificationDoc.id,
            title: data.title || "Notification",
            message: data.message || "",
            read: Boolean(data.read),
            createdAt: data.createdAt || null,
            type: data.type || null,
            contentId: data.contentId || null,
            metadata: data.metadata || null,
          };
        });
        setNotifications(next);
        setNotificationsError(null);
      },
      (error) => {
        console.error("Error loading notifications:", error);
        setNotificationsError("Couldn't load notifications right now.");
      }
    );

    return unsubscribe;
  }, [user?.uid]);

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

  // Aminah: Function to determine the appropriate action route and label based on notification type

  const getNotificationAction = (notification) => {
    const type = notification?.type;
    const actionRoute = notification?.metadata?.actionRoute;
    const actionLabel = notification?.metadata?.actionLabel;

    if (actionRoute) {
      return { route: actionRoute, label: actionLabel || "Open" };
    }

    if (type === "reviewer_assigned") {
      return { route: "/review", label: "Go to review" };
    }
    if (type === "content_updated") {
      return { route: "/review", label: "Go to review" };
    }
    if (type === "review_approved") {
      return { route: "/dashboard", label: "Go to content" };
    }
    if (type === "review_rejected") {
      return { route: "/dashboard", label: "Go to content" };
    }
    if (type === "content_rejected") {
      return { route: "/dashboard", label: "Go to content" };
    }
    if (type === "ready_to_post") {
      return { route: "/calendar", label: "Go to calendar" };
    }
    if (type === "content_scheduled") {
      return { route: "/calendar", label: "Go to calendar" };
    }
    return { route: "/dashboard", label: "Go to dashboard" };
  };

  // Aminah: Calculate unread notifications count for badge display

  const unreadCount = visibleNotifications.filter((item) => !item.read).length;
  const allSelected =
    visibleNotifications.length > 0 &&
    selectedNotificationIds.length === visibleNotifications.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedNotificationIds.length > 0 && !allSelected;
  }, [selectedNotificationIds.length, allSelected]);

  // Aminah: Toggle function to open/close notifications and profile menus
  const toggleMenu = (menuName) => {
    setActiveMenu((current) => (current === menuName ? null : menuName));
  };

  const toggleNotificationSelection = (notificationId) => {
    setSelectedNotificationIds((current) =>
      current.includes(notificationId)
        ? current.filter((id) => id !== notificationId)
        : [...current, notificationId]
    );
  };

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedNotificationIds([]);
      return;
    }
    setSelectedNotificationIds(visibleNotifications.map((item) => item.id));
  };

  const handleMarkSelectedAsRead = async () => {
    if (!user?.uid || selectedNotificationIds.length === 0) return;

    const selectedSet = new Set(selectedNotificationIds);
    const previousNotifications = visibleNotifications;

    setNotifications((current) =>
      current.map((item) =>
        selectedSet.has(item.id) ? { ...item, read: true } : item
      )
    );
    setSelectedNotificationIds([]);

    try {
      const batch = writeBatch(db);
      visibleNotifications.forEach((item) => {
        if (selectedSet.has(item.id) && !item.read) {
          const notificationRef = doc(db, "Users", user.uid, "notifications", item.id);
          batch.update(notificationRef, {
            read: true,
            readAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking selected notifications as read:", error);
      setNotifications((current) =>
        current.map((item) => {
          const previous = previousNotifications.find((oldItem) => oldItem.id === item.id);
          return previous ? { ...item, read: previous.read } : item;
        })
      );
    }
  };

  const handleDeleteSelected = async () => {
    if (!user?.uid || selectedNotificationIds.length === 0) return;

    const idsToDelete = [...selectedNotificationIds];
    const selectedSet = new Set(idsToDelete);
    setExpandedNotificationId((current) =>
      current && selectedSet.has(current) ? null : current
    );
    setSelectedNotificationIds([]);

    try {
      const batch = writeBatch(db);
      visibleNotifications.forEach((item) => {
        if (selectedSet.has(item.id)) {
          const notificationRef = doc(db, "Users", user.uid, "notifications", item.id);
          batch.update(notificationRef, { deleted: true });
        }
      });
      await batch.commit();

      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }

      setUndoPayload({ ids: idsToDelete, count: idsToDelete.length });
      undoTimerRef.current = setTimeout(() => {
        setUndoPayload(null);
        const deleteBatch = writeBatch(db);
        idsToDelete.forEach((id) => {
          const notificationRef = doc(db, "Users", user.uid, "notifications", id);
          deleteBatch.delete(notificationRef);
        });
        deleteBatch.commit().catch(() => {});
      }, 4000);
    } catch (error) {
      console.error("Error deleting selected notifications:", error);
    }
  };

  // Aminah: Handle notification selection, mark as read, and update state
  const handleNotificationSelect = async (notificationId) => {
    setExpandedNotificationId((current) =>
      current === notificationId ? null : notificationId
    );

    const target = visibleNotifications.find((item) => item.id === notificationId);
    if (!target || target.read || !user?.uid) return;

    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item
      )
    );

    try {
      const notificationRef = doc(db, "Users", user.uid, "notifications", notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read: false } : item
        )
      );
    }
  };

  const handleUndoDelete = async () => {
    if (!undoPayload || !user?.uid) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    const idsToRestore = undoPayload.ids;
    setUndoPayload(null);
    try {
      const batch = writeBatch(db);
      idsToRestore.forEach((id) => {
        const notificationRef = doc(db, "Users", user.uid, "notifications", id);
        batch.update(notificationRef, { deleted: false });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error undoing delete:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid || unreadCount === 0) return;

    const previousNotifications = visibleNotifications;

    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true }))
    );

    try {
      const batch = writeBatch(db);
      visibleNotifications.forEach((item) => {
        if (!item.read) {
          const notificationRef = doc(db, "Users", user.uid, "notifications", item.id);
          batch.update(notificationRef, {
            read: true,
            readAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      setNotifications((current) =>
        current.map((item) =>
          previousNotifications.find((original) => original.id === item.id)?.read
            ? item
            : { ...item, read: false }
        )
      );
    }
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
                disabled={unreadCount === 0}
              >
                Mark all as read
              </button>
            </div>

            <div className="notifications-select-row">
              <label className="notifications-select-main">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleToggleSelectAll}
                  aria-label="Select all notifications"
                />
                <span>{selectedNotificationIds.length} selected</span>
              </label>
              {selectedNotificationIds.length > 0 && (
                <span className="notifications-select-actions">
                  <button
                    type="button"
                    className="notifications-select-action-btn"
                    data-tooltip="Mark as read"
                    aria-label="Mark as read"
                    onClick={handleMarkSelectedAsRead}
                  >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 13 8 16 13 11" />
                      <polyline points="11 13 14 16 19 11" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="notifications-select-action-btn notifications-select-action-btn-danger"
                    data-tooltip="Delete"
                    aria-label="Delete"
                    onClick={handleDeleteSelected}
                  >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </span>
              )}
            </div>

            <div className="notification-list" role="list">
              {visibleNotificationsError && (
                <div className="notification-list-state" role="status">
                  {visibleNotificationsError}
                </div>
              )}

              {!visibleNotificationsError && visibleNotifications.length === 0 && (
                <div className="notification-list-state" role="status">
                  No notifications yet.
                </div>
              )}

              {visibleNotifications.map((item) => {
                const action = getNotificationAction(item);
                return (
                <button
                  key={item.id}
                  type="button"
                  className={`notification-item${item.id === expandedNotificationId ? " active" : ""}${item.read ? "" : " unread"}`}
                  aria-expanded={item.id === expandedNotificationId}
                  onClick={() => handleNotificationSelect(item.id)}
                >
                  <input
                    type="checkbox"
                    className="notification-item-select"
                    checked={selectedNotificationIds.includes(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleNotificationSelection(item.id)}
                    aria-label={`Select ${item.title}`}
                  />
                  <span className="notification-item-dot" aria-hidden="true" />
                  <span className="notification-item-copy">
                    <strong>{item.title}</strong>
                    <span>{truncateMessage(item.message)}</span>
                    {item.id === expandedNotificationId && (
                      <span className="notification-item-expanded">
                        <button
                          type="button"
                          className="notification-go-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(null);
                            navigate(action.route, {
                              state: {
                                highlightContentId: item.contentId || null,
                                notificationType: item.type || null,
                                notificationId: item.id,
                              },
                            });
                          }}
                        >
                          {action.label}
                        </button>
                      </span>
                    )}
                  </span>
                  <span className="notification-time">{formatRelativeTime(item.createdAt)}</span>
                </button>
                );
              })}
            </div>

            {undoPayload && (
              <div className="notification-undo-toast">
                <span>
                  {undoPayload.count > 1
                    ? `${undoPayload.count} notifications deleted`
                    : "Notification deleted"}
                </span>
                <button type="button" onClick={handleUndoDelete}>Undo</button>
              </div>
            )}
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
