// src/pages/SeasonsMaintenance.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./ConfigMaintenance.css"; // Reuse existing styles
import { getSeasons, updateSeasons } from "../api/seasons";

function SeasonsMaintenance() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load seasons config on mount
  useEffect(() => {
    loadSeasons();
  }, []);

  async function loadSeasons() {
    try {
      setLoading(true);
      const cfg = await getSeasons();
      setConfig(cfg || { seasons: [] });
    } catch (e) {
      console.error("Failed to load seasons", e);
      toast.error("Failed to load seasons configuration");
      setConfig({ seasons: [] });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    try {
      setSaving(true);
      await updateSeasons(config);
      toast.success("Seasons configuration saved successfully!");
    } catch (e) {
      console.error("Failed to save seasons", e);
      toast.error(e.message || "Failed to save seasons configuration");
    } finally {
      setSaving(false);
    }
  }

  function addSeason() {
    const newSeasons = [
      ...config.seasons,
      {
        id: `season-${Date.now()}`,
        title: "",
        startDate: "",
        endDate: "",
      },
    ];
    setConfig({ ...config, seasons: newSeasons });
    toast.success("Season added. Fill in details and save!");
  }

  function deleteSeason(index) {
    if (!window.confirm(`Delete this season?`)) return;
    const newSeasons = config.seasons.filter((_, i) => i !== index);
    setConfig({ ...config, seasons: newSeasons });
    toast.success("Season deleted. Don't forget to save!");
  }

  function updateSeason(index, field, value) {
    const newSeasons = [...config.seasons];
    newSeasons[index] = { ...newSeasons[index], [field]: value };
    setConfig({ ...config, seasons: newSeasons });
  }

  if (loading) {
    return (
      <div className="config-container">
        <div className="config-header">
          <h1>Seasons Management</h1>
        </div>
        <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="config-container">
        <div className="config-header">
          <h1>Seasons Management</h1>
        </div>
        <div style={{ padding: "20px", textAlign: "center", color: "#ef4444" }}>
          Failed to load configuration
        </div>
      </div>
    );
  }

  return (
    <div className="config-container">
      <div className="config-header">
        <div className="config-header-left">
          <button className="back-btn" onClick={() => navigate("/config")}>
            ← Back
          </button>
          <h1>Seasons Management</h1>
        </div>
        <div className="config-actions">
          <button className="btn-primary" onClick={addSeason}>
            + Add Season
          </button>
          <button
            className="btn-success"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "💾 Save All"}
          </button>
        </div>
      </div>

      <div className="config-content">
        {config.seasons.length === 0 ? (
          <div className="empty-state">
            <p>No seasons configured yet.</p>
            <button className="btn-primary" onClick={addSeason}>
              + Add First Season
            </button>
          </div>
        ) : (
          <div className="seasons-grid">
            {config.seasons.map((season, idx) => (
              <div key={season.id || idx} className="season-card">
                <div className="season-card-header">
                  <h3>Season {idx + 1}</h3>
                  <button
                    className="btn-danger-small"
                    onClick={() => deleteSeason(idx)}
                    title="Delete season"
                  >
                    🗑️
                  </button>
                </div>

                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={season.title || ""}
                    onChange={(e) => updateSeason(idx, "title", e.target.value)}
                    placeholder="e.g., Fall 2024"
                  />
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={season.startDate || ""}
                    onChange={(e) => updateSeason(idx, "startDate", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={season.endDate || ""}
                    onChange={(e) => updateSeason(idx, "endDate", e.target.value)}
                  />
                </div>

                {season.startDate && season.endDate && (
                  <div className="season-summary">
                    <small>
                      Duration: {formatDateRange(season.startDate, season.endDate)}
                    </small>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateRange(start, end) {
  if (!start || !end) return "";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const weeks = Math.round(days / 7);
  return `${days} days (~${weeks} weeks)`;
}

export default SeasonsMaintenance;
