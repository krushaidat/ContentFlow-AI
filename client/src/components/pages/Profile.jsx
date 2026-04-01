import React, { useEffect, useRef, useState } from "react";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { deleteUser, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";
import userIcon from "../../assets/user.png";
import "../styles/profile.css";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana",
  "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti",
  "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan",
  "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique",
  "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand",
  "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden",
  "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand",
  "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];

// 500 KB cap on profile photos stored as base64 in Firestore
const MAX_IMAGE_BYTES = 512_000;

const Profile = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const countryRef = useRef(null);

  const [profileImage, setProfileImage] = useState(userIcon);
  const [teamName, setTeamName] = useState("-");
  const [form, setForm] = useState({ displayName: "", email: "", gender: "", country: "" });
  const [editingField, setEditingField] = useState(null);
  const [draftValue, setDraftValue] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Sync form fields whenever the live Firestore user object updates
  useEffect(() => {
    if (!user) return;
    const fullName = user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim();
    setForm({
      displayName: fullName,
      email: user.email || "",
      gender: user.gender || "",
      country: user.country || "",
    });
    if (user.profileImage) setProfileImage(user.profileImage);
  }, [user]);

  // Pull the team name from Firestore whenever the user's teamId changes
  useEffect(() => {
    if (!user?.teamId) {
      setTeamName("-");
      return;
    }
    getDoc(doc(db, "teams", user.teamId)).then((snap) => {
      setTeamName(snap.exists() ? snap.data().name || "-" : "-");
    });
  }, [user?.teamId]);

  // Shows a toast notification that auto-clears after 5 seconds
  const flashStatus = (text, type = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: "", type: "" }), 5000);
  };

  // Opens inline edit mode for a given profile field
  const startEditing = (key, current) => {
    setEditingField(key);
    setDraftValue(current || "");
    if (key === "country") setCountrySearch(current || "");
  };

  // Discards any unsaved changes and closes the inline editor
  const cancelEditing = () => {
    setEditingField(null);
    setDraftValue("");
    setCountrySearch("");
  };

  // Writes a single field update to Firestore; also keeps firstName/lastName in sync if the full name changed
  const persistField = async (fieldKey, value) => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      const trimmed = typeof value === "string" ? value.trim() : value;
      const update = { [fieldKey]: trimmed };

      if (fieldKey === "displayName") {
        const parts = trimmed.split(/\s+/);
        update.firstName = parts[0] || "";
        update.lastName = parts.slice(1).join(" ") || "";
      }

      await updateDoc(doc(db, "Users", user.uid), update);
      setForm((prev) => ({ ...prev, [fieldKey]: trimmed }));
      setEditingField(null);
      setDraftValue("");
      setCountrySearch("");
    } catch {
      flashStatus("Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Saves whichever field is currently being edited
  const saveField = () => persistField(editingField, draftValue);

  // Keyboard shortcuts: Enter saves, Escape cancels
  const handleKeySave = (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveField(); }
    if (e.key === "Escape") cancelEditing();
  };

  // Reads the selected image file, enforces the size limit, then saves it to Firestore as base64
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !user?.uid) return;

    if (file.size > MAX_IMAGE_BYTES) {
      flashStatus("Image too large. Please choose a photo under 500 KB.", "error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = ev.target.result;
      setProfileImage(img);
      try {
        await updateDoc(doc(db, "Users", user.uid), { profileImage: img });
      } catch (err) {
        console.error("Image save error:", err);
        flashStatus("Failed to save photo.", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  // Sends a password reset email to the currently signed-in user
  const handleChangePassword = async () => {
    if (!auth.currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      flashStatus(`Password reset email sent to ${auth.currentUser.email}.`);
    } catch {
      flashStatus("Failed to send reset email. Please try again.", "error");
    }
  };

  // Deletes the user's Firestore document and Firebase Auth account, then redirects to login
  const handleDeleteAccount = async () => {
    if (!auth.currentUser || deleting) return;
    setDeleting(true);
    try {
      const uid = auth.currentUser.uid;
      await deleteDoc(doc(db, "Users", uid));
      await deleteUser(auth.currentUser);
      setDeleteModal(false);
      setDeleteConfirmText("");
      localStorage.removeItem("userSession");
      window.location.replace("/login");
    } catch (e) {
      setDeleteModal(false);
      setDeleteConfirmText("");
      if (e.code === "auth/requires-recent-login") {
        flashStatus("Please sign out and sign back in, then try deleting again.", "error");
      } else {
        flashStatus("Failed to delete account. Please try again.", "error");
      }
    } finally {
      setDeleting(false);
    }
  };

  // Filters the country list to whatever the user has typed so far
  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Capitalises the first letter of a role string, falls back to "User"
  const formatRole = (role) =>
    role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

  // ── Inline SVG icons ────────────────────────────────────────────────────────

  const IconEdit = () => (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M13.5 3.8a1.8 1.8 0 1 1 2.6 2.5l-7.8 7.8-3.3.8.8-3.3 7.7-7.8Z" fill="currentColor" />
    </svg>
  );

  const IconSave = () => (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.1 7a1 1 0 0 1-1.4 0L4 9.6a1 1 0 1 1 1.4-1.4L8.9 12l6.4-6.7a1 1 0 0 1 1.4 0Z" fill="currentColor" />
    </svg>
  );

  const IconClose = () => (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5.2 5.2a1 1 0 0 1 1.4 0L10 8.6l3.4-3.4a1 1 0 1 1 1.4 1.4L11.4 10l3.4 3.4a1 1 0 0 1-1.4 1.4L10 11.4l-3.4 3.4a1 1 0 0 1-1.4-1.4L8.6 10 5.2 6.6a1 1 0 0 1 0-1.4Z" fill="currentColor" />
    </svg>
  );

  const IconCamera = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4.5a1.5 1.5 0 0 0-1.3.8l-.7 1.2H5A2.5 2.5 0 0 0 2.5 9v9A2.5 2.5 0 0 0 5 20.5h14a2.5 2.5 0 0 0 2.5-2.5V9A2.5 2.5 0 0 0 19 6.5h-2l-.7-1.2A1.5 1.5 0 0 0 15 4.5H9Zm3 4a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" fill="currentColor" />
    </svg>
  );

  // Fields the user is allowed to edit inline
  const editableFields = [
    { key: "displayName", label: "Full Name", type: "text" },
    { key: "gender",      label: "Gender",    type: "select" },
    { key: "country",     label: "Country",   type: "country" },
  ];

  // Read-only fields pulled from Firestore / auth that the user cannot change here
  const readonlyFields = [
    { key: "email", label: "Email Address", value: form.email },
    { key: "team",  label: "Team Name",     value: teamName },
    { key: "role",  label: "Role",          value: formatRole(user?.role) },
  ];

  if (!user) {
    return (
      <div className="profile-page modern-profile-page">
        <div className="profile-shell" style={{ padding: 32 }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-page modern-profile-page">
      <div className="profile-shell">

        <header className="profile-header-modern">
          <div className="profile-avatar-section">
            <button
              className="profile-avatar"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload profile photo"
            >
              <img src={profileImage} alt="User" />
              <span className="avatar-overlay"><IconCamera /></span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
          </div>
          <div className="profile-heading">
            <h2>{form.displayName || "User"}</h2>
            <p>{form.email || "No email address"}</p>
          </div>
        </header>

        {statusMsg.text && (
          <div className={`profile-toast ${statusMsg.type}`} role="alert">
            <span className="profile-toast-msg">{statusMsg.text}</span>
            <button
              className="profile-toast-close"
              type="button"
              onClick={() => setStatusMsg({ text: "", type: "" })}
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5.2 5.2a1 1 0 0 1 1.4 0L10 8.6l3.4-3.4a1 1 0 1 1 1.4 1.4L11.4 10l3.4 3.4a1 1 0 0 1-1.4 1.4L10 11.4l-3.4 3.4a1 1 0 0 1-1.4-1.4L8.6 10 5.2 6.6a1 1 0 0 1 0-1.4Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}

        <section className="profile-section">
          <h3 className="profile-section-title">Profile Information</h3>
          <div className="profile-rows">
            {editableFields.map((field) => {
              const isEditing = editingField === field.key;
              return (
                <div key={field.key} className={`profile-row ${isEditing ? "is-editing" : ""}`}>
                  <span className="row-label">{field.label}</span>

                  <div className="row-value">
                    {isEditing ? (
                      field.type === "select" ? (
                        <select
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onKeyDown={handleKeySave}
                          autoFocus
                        >
                          <option value="">Select</option>
                          {GENDER_OPTIONS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      ) : field.type === "country" ? (
                        <div className="country-wrap" ref={countryRef}>
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={(e) => {
                              setCountrySearch(e.target.value);
                              setDraftValue(e.target.value);
                            }}
                            onKeyDown={handleKeySave}
                            placeholder="Type to search country..."
                            autoFocus
                          />
                          {countrySearch.length > 0 && filteredCountries.length > 0 && (
                            <ul className="country-dropdown">
                              {filteredCountries.slice(0, 8).map((c) => (
                                <li
                                  key={c}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    persistField("country", c);
                                  }}
                                >
                                  {c}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onKeyDown={handleKeySave}
                          autoFocus
                        />
                      )
                    ) : (
                      <span>{form[field.key] || "-"}</span>
                    )}
                  </div>

                  <div className="row-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="icon-btn save"
                          type="button"
                          onClick={saveField}
                          disabled={saving}
                          aria-label={`Save ${field.label}`}
                        >
                          <IconSave />
                        </button>
                        <button
                          className="icon-btn cancel"
                          type="button"
                          onClick={cancelEditing}
                          aria-label="Cancel"
                        >
                          <IconClose />
                        </button>
                      </>
                    ) : (
                      <button
                        className="icon-btn edit"
                        type="button"
                        onClick={() => startEditing(field.key, form[field.key])}
                        aria-label={`Edit ${field.label}`}
                      >
                        <IconEdit />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {readonlyFields.map((field) => (
              <div key={field.key} className="profile-row readonly-row">
                <span className="row-label">{field.label}</span>
                <div className="row-value">
                  <span className="readonly-value">
                    {field.value || "-"}
                    {field.badge && <span className="email-badge">{field.badge}</span>}
                  </span>
                </div>
                <div className="row-actions-spacer" />
              </div>
            ))}
          </div>
        </section>

        <section className="profile-settings-section">
          <h3 className="profile-section-title">Settings</h3>
          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-label">Change Password</span>
                <span className="setting-desc">A reset link will be sent to your email address</span>
              </div>
              <button className="outline-action" type="button" onClick={handleChangePassword}>
                Change Password
              </button>
            </div>
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-label">Delete Account</span>
                <span className="setting-desc">Permanently removes your account and all data</span>
              </div>
              <button
                className="danger-action"
                type="button"
                onClick={() => { setDeleteModal(true); setDeleteConfirmText(""); }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </div>

      {deleteModal && (
        <div
          className="delete-modal-overlay"
          onClick={() => { setDeleteModal(false); setDeleteConfirmText(""); }}
        >
          <div
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="delete-modal-header">
              <h3 id="delete-modal-title">Delete Account</h3>
              <button
                className="delete-modal-close"
                type="button"
                onClick={() => { setDeleteModal(false); setDeleteConfirmText(""); }}
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5.2 5.2a1 1 0 0 1 1.4 0L10 8.6l3.4-3.4a1 1 0 1 1 1.4 1.4L11.4 10l3.4 3.4a1 1 0 0 1-1.4 1.4L10 11.4l-3.4 3.4a1 1 0 0 1-1.4-1.4L8.6 10 5.2 6.6a1 1 0 0 1 0-1.4Z" fill="currentColor" />
                </svg>
              </button>
            </div>

            <p className="delete-modal-body">
              This action is <strong>permanent and cannot be undone</strong>. Your account and all associated data will be deleted immediately.
            </p>
            <p className="delete-modal-prompt">Type <strong>confirm</strong> below to proceed:</p>

            <input
              className="delete-modal-input"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="confirm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteConfirmText === "confirm") handleDeleteAccount();
                if (e.key === "Escape") { setDeleteModal(false); setDeleteConfirmText(""); }
              }}
            />

            <div className="delete-modal-actions">
              <button
                className="delete-modal-cancel"
                type="button"
                onClick={() => { setDeleteModal(false); setDeleteConfirmText(""); }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="delete-modal-confirm"
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "confirm" || deleting}
              >
                {deleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;