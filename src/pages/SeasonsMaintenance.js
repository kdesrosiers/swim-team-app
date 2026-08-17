// src/pages/SeasonsMaintenance.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./ConfigMaintenance.css";
import { getSeasons, updateSeasons } from "../api/seasons";
import { getConfig } from "../api/config";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const POOL_OPTIONS = ["SCY", "SCM", "LCM"];

function SeasonsMaintenance() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [cfg, rosterCfg] = await Promise.all([getSeasons(), getConfig()]);
      setConfig(cfg || { seasons: [] });
      setRosters(Array.isArray(rosterCfg?.rosters) ? rosterCfg.rosters : []);
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
        schedule: {},
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

  function updateSeasonRosterPool(seasonIdx, roster, pool) {
    const newSeasons = [...config.seasons];
    const season = { ...newSeasons[seasonIdx] };
    season.schedule = {
      ...season.schedule,
      [roster]: { ...season.schedule?.[roster], pool },
    };
    newSeasons[seasonIdx] = season;
    setConfig({ ...config, seasons: newSeasons });
  }

  function updateSeasonScheduleDay(seasonIdx, roster, day, value) {
    const newSeasons = [...config.seasons];
    const season = { ...newSeasons[seasonIdx] };
    season.schedule = {
      ...season.schedule,
      [roster]: { ...season.schedule?.[roster], [day]: value },
    };
    newSeasons[seasonIdx] = season;
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
          <div className="seasons-list">
            {config.seasons.map((season, idx) => (
              <div key={season.id || idx} className="season-card season-card--expanded">
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

                {/* Basic season info */}
                <div className="season-info-row">
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      className="form-input"
                      value={season.title || ""}
                      onChange={(e) => updateSeason(idx, "title", e.target.value)}
                      placeholder="e.g., Fall 2025"
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
                    <div className="form-group form-group--duration">
                      <label>Duration</label>
                      <span className="season-duration">
                        {formatDateRange(season.startDate, season.endDate)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Per-roster practice schedule */}
                {rosters.length > 0 && (
                  <div className="season-schedule-section">
                    <h4 className="season-schedule-heading">Practice Schedule</h4>
                    <p className="season-schedule-hint">
                      Set practice start times and pool type per group. The practice builder will use these when the practice date falls within this season.
                    </p>
                    <div className="season-schedule-table">
                      {/* Header row */}
                      <div className="season-schedule-row season-schedule-row--header">
                        <div className="season-schedule-cell season-schedule-cell--roster">Group</div>
                        <div className="season-schedule-cell season-schedule-cell--pool">Pool</div>
                        {DOW.map(day => (
                          <div key={day} className="season-schedule-cell season-schedule-cell--day">{day}</div>
                        ))}
                      </div>
                      {/* One row per roster */}
                      {rosters.map(roster => {
                        const rSched = season.schedule?.[roster] || {};
                        return (
                          <div key={roster} className="season-schedule-row">
                            <div className="season-schedule-cell season-schedule-cell--roster">
                              <span className="roster-label">{roster}</span>
                            </div>
                            <div className="season-schedule-cell season-schedule-cell--pool">
                              <select
                                className="pool-select-sm"
                                value={rSched.pool || ""}
                                onChange={(e) => updateSeasonRosterPool(idx, roster, e.target.value)}
                              >
                                <option value="">--</option>
                                {POOL_OPTIONS.map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </div>
                            {DOW.map(day => (
                              <div key={day} className="season-schedule-cell season-schedule-cell--day">
                                <input
                                  type="text"
                                  className="time-input-sm"
                                  placeholder="OFF"
                                  value={rSched[day] || ""}
                                  onChange={(e) => updateSeasonScheduleDay(idx, roster, day, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
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
