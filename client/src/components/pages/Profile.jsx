// PROFILE PAGE - Tanvir
// Displays user info in a card, lets user edit their info, and return to dashboard
import React, { useState, useRef } from "react";
import userIcon from "../../assets/user.png";
import "../styles/profile.css";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  // Tanvir: Load user info from localStorage/session
  const sessionUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("userSession") || "null");
    } catch {
      return null;
    }
  })();

  // Tanvir: State for edit mode and form
  const [editMode, setEditMode] = useState(false);
  const [profileImage, setProfileImage] = useState(sessionUser?.profileImage || userIcon);
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState({
    displayName: sessionUser?.displayName || "",
    email: sessionUser?.email || "",
    teamName: sessionUser?.teamName || "",
    gender: sessionUser?.gender || "",
    country: sessionUser?.country || "",
    language: sessionUser?.language || "",
    timeZone: sessionUser?.timeZone || "",
  });

  const navigate = useNavigate();

  // Tanvir: Handle form changes
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Tanvir: Handle profile image upload
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Tanvir: Save edits to localStorage
  const handleSave = () => {
    localStorage.setItem(
      "userSession",
      JSON.stringify({ ...sessionUser, ...form, profileImage })
    );
    setEditMode(false);
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        {/* Tanvir: Top section with profile info and edit button */}
        <div className="profile-header">
          {/* Tanvir: Profile image with upload capability */}
          <div className="profile-avatar-section">
            <div className="profile-avatar" onClick={() => editMode && fileInputRef.current?.click()}>
              <img src={profileImage} alt="User" />
              {editMode && <div className="upload-overlay">📷</div>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
          </div>
          <div className="profile-info">
            <h2>{form.displayName || "User"}</h2>
            <p>{form.email}</p>
          </div>

          {/* Edit and Dashboard buttons */}
          <div className="header-buttons">
            {!editMode && (
              <button className="edit-btn" onClick={() => setEditMode(true)}>
                Edit
              </button>
            )}
            {!editMode && (
              <button className="back-btn" onClick={() => navigate("/dashboard")}>
                Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Form columns setup with two columns */}
        {editMode ? (
          <div className="profile-form-container">
            <h3>Edit Profile</h3>
            <form className="profile-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              {/* Row 1 */}
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    name="displayName"
                    value={form.displayName}
                    onChange={handleChange}
                    placeholder="Your Full Name"
                  />
                </div>
                <div className="form-group">
                  <label>Team Name</label>
                  <input
                    name="teamName"
                    value={form.teamName}
                    onChange={handleChange}
                    placeholder="Your Team Name"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="form-row">
                <div className="form-group">
                  <label>Gender</label>
                  <select name="gender" value={form.gender} onChange={handleChange}>
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <select name="country" value={form.country} onChange={handleChange}>
                    <option value="">Select Country</option>
                    <option value="usa">USA</option>
                    <option value="uk">UK</option>
                    <option value="canada">Canada</option>
                    <option value="australia">Australia</option>
                  </select>
                </div>
              </div>

              {/* Row 3 */}
              <div className="form-row">
                <div className="form-group">
                  <label>Language</label>
                  <select name="language" value={form.language} onChange={handleChange}>
                    <option value="">Select Language</option>
                    <option value="english">English</option>
                    <option value="spanish">Spanish</option>
                    <option value="french">French</option>
                    <option value="german">German</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Time Zone</label>
                  <select name="timeZone" value={form.timeZone} onChange={handleChange}>
                    <option value="">Select Time Zone</option>
                    <option value="est">EST</option>
                    <option value="cst">CST</option>
                    <option value="mst">MST</option>
                    <option value="pst">PST</option>
                  </select>
                </div>
              </div>

              {/* Email Section */}
              <div className="email-section">
                <h4>My email Address</h4>
                <div className="email-item">
                  <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Your Email"
                  />
                  <span className="email-primary">Primary</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="profile-actions">
                <button className="profile-btn" type="submit">Save</button>
                <button className="profile-btn cancel-btn" type="button" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            </form>
          </div>
        ) : (
          /* View mode - display user info */
          <div className="profile-view">
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <p>{form.displayName || "-"}</p>
              </div>
              <div className="form-group">
                <label>Team Name</label>
                <p>{form.teamName || "-"}</p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Gender</label>
                <p>{form.gender || "-"}</p>
              </div>
              <div className="form-group">
                <label>Country</label>
                <p>{form.country || "-"}</p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Language</label>
                <p>{form.language || "-"}</p>
              </div>
              <div className="form-group">
                <label>Time Zone</label>
                <p>{form.timeZone || "-"}</p>
              </div>
            </div>

            {/* Email Section in View Mode */}
            <div className="email-section">
              <h4>My email Address</h4>
              <div className="email-item">
                <span className="email-address">{form.email}</span>
                <span className="email-primary">Primary</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
