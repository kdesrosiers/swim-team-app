import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { put } from "../api/client";
import "./UserSettings.css";

export default function UserSettings() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    exportDirectory: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setFormData({
          exportDirectory: userData.exportDirectory || "",
        });
      } catch (e) {
        console.error("Failed to parse user data:", e);
        toast.error("Failed to load user data");
      }
    }
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("User not found");
      return;
    }

    setSaving(true);

    try {
      const response = await put(`/api/users/${user._id}`, {
        exportDirectory: formData.exportDirectory,
      });

      // Update localStorage with the updated user data
      const updatedUser = { ...user, ...response };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="user-settings"><p>Loading...</p></div>;
  }

  return (
    <div className="user-settings">
      <div className="settings-container">
        <div className="settings-card">
          <h1>User Settings</h1>

          <div className="settings-section">
            <h2>Profile Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Name</label>
                <p>{user.firstName} {user.lastName}</p>
              </div>
              <div className="info-item">
                <label>Email</label>
                <p>{user.email}</p>
              </div>
              <div className="info-item">
                <label>Username</label>
                <p>{user.username}</p>
              </div>
              {user.swimTeam && user.swimTeam.name && (
                <div className="info-item">
                  <label>Team</label>
                  <p>{user.swimTeam.name}</p>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="settings-form">
            <div className="settings-section">
              <h2>Export Settings</h2>
              <div className="form-group">
                <label htmlFor="exportDirectory">Export Directory</label>
                <input
                  type="text"
                  id="exportDirectory"
                  name="exportDirectory"
                  value={formData.exportDirectory}
                  onChange={handleChange}
                  placeholder="e.g., C:\\Users\\YourName\\Desktop\\Practices"
                />
                <small>
                  Where practice files will be saved when you export. Leave empty to use default.
                </small>
              </div>
            </div>

            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
