// src/pages/ConfigMaintenance.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./ConfigMaintenance.css";
import { getConfig, updateConfig } from "../api/config";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ConfigMaintenance() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRosterName, setNewRosterName] = useState("");
  const [draftNames, setDraftNames] = useState({});

  // Load config on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  async function loadConfiguration() {
    try {
      setLoading(true);
      const cfg = await getConfig();
      setConfig(cfg || { rosters: [], warmups: {}, practiceSchedule: {}, defaultRoster: "", defaultPool: "SCM" });
    } catch (e) {
      console.error("Failed to load config", e);
      toast.error("Failed to load configuration");
      setConfig({ rosters: [], warmups: {}, practiceSchedule: {}, defaultRoster: "", defaultPool: "SCM" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    try {
      setSaving(true);
      await updateConfig(config);
      toast.success("Configuration saved successfully!");
    } catch (e) {
      console.error("Failed to save config", e);
      toast.error(e.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  // Roster management
  function addRoster() {
    const trimmed = newRosterName.trim();
    if (!trimmed) return;
    if (config.rosters.includes(trimmed)) {
      toast.error("Roster already exists");
      return;
    }

    setConfig({
      ...config,
      rosters: [...config.rosters, trimmed],
      warmups: { ...config.warmups, [trimmed]: "" },
      practiceSchedule: {
        ...config.practiceSchedule,
        [trimmed]: { Mon: "OFF", Tue: "OFF", Wed: "OFF", Thu: "OFF", Fri: "OFF", Sat: "OFF", Sun: "OFF" }
      },
    });
    setNewRosterName("");
    toast.success("Roster added. Don't forget to save!");
  }

  function renameRoster(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if (config.rosters.includes(trimmed)) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }

    const newWarmups = {};
    for (const [k, v] of Object.entries(config.warmups)) {
      newWarmups[k === oldName ? trimmed : k] = v;
    }
    const newSchedule = {};
    for (const [k, v] of Object.entries(config.practiceSchedule)) {
      newSchedule[k === oldName ? trimmed : k] = v;
    }

    setConfig({
      ...config,
      rosters: config.rosters.map(r => (r === oldName ? trimmed : r)),
      warmups: newWarmups,
      practiceSchedule: newSchedule,
      defaultRoster: config.defaultRoster === oldName ? trimmed : config.defaultRoster,
    });
    setDraftNames(prev => { const n = { ...prev }; delete n[oldName]; return n; });
    toast.success(`Renamed to "${trimmed}". Don't forget to save!`);
  }

  function getDraftName(roster) {
    return draftNames[roster] ?? roster;
  }

  function onNameChange(roster, value) {
    setDraftNames(prev => ({ ...prev, [roster]: value }));
  }

  function commitRename(roster) {
    const draft = draftNames[roster];
    if (draft === undefined) return;
    renameRoster(roster, draft);
  }

  function deleteRoster(rosterName) {
    if (!window.confirm(`Delete roster "${rosterName}"?`)) return;

    const newRosters = config.rosters.filter(r => r !== rosterName);
    const newWarmups = { ...config.warmups };
    delete newWarmups[rosterName];
    const newSchedule = { ...config.practiceSchedule };
    delete newSchedule[rosterName];

    setConfig({
      ...config,
      rosters: newRosters,
      warmups: newWarmups,
      practiceSchedule: newSchedule,
      defaultRoster: config.defaultRoster === rosterName ? "" : config.defaultRoster,
    });
    toast.success("Roster deleted. Don't forget to save!");
  }

  function updateWarmup(rosterName, value) {
    setConfig({
      ...config,
      warmups: { ...config.warmups, [rosterName]: value },
    });
  }

  function updateScheduleTime(rosterName, day, value) {
    setConfig({
      ...config,
      practiceSchedule: {
        ...config.practiceSchedule,
        [rosterName]: {
          ...config.practiceSchedule[rosterName],
          [day]: value,
        },
      },
    });
  }

  function setDefaultRoster(rosterName) {
    setConfig({ ...config, defaultRoster: rosterName });
  }

  function setDefaultPool(pool) {
    setConfig({ ...config, defaultPool: pool });
  }

  if (loading) {
    return (
      <div className="config-page">
        <div className="config-container">
          <h1>Configuration Maintenance</h1>
          <p>Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="config-page">
        <div className="config-container">
          <h1>Configuration Maintenance</h1>
          <p>Failed to load configuration.</p>
          <button onClick={loadConfiguration}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="config-page">
      <div className="config-container">
        <div className="config-header">
          <div className="config-header-left">
            <button className="back-btn" onClick={() => navigate("/config")}>
              ← Back
            </button>
            <h1>Roster Configuration</h1>
          </div>
          <div className="config-actions">
            <button className="config-btn save" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "💾 Save Configuration"}
            </button>
            <button className="config-btn" onClick={loadConfiguration}>
              🔄 Reload
            </button>
          </div>
        </div>

        {/* Default Roster */}
        <section className="config-section">
          <h2>Default Roster</h2>
          <select
            className="default-roster-select"
            value={config.defaultRoster || ""}
            onChange={(e) => setDefaultRoster(e.target.value)}
          >
            <option value="">-- Select Default --</option>
            {config.rosters.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </section>

        {/* Off-Season Default Pool */}
        <section className="config-section">
          <h2>Off-Season Default Pool Type</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "8px" }}>
            Used when the practice date falls outside any configured season.
          </p>
          <select
            className="default-roster-select"
            value={config.defaultPool || "SCM"}
            onChange={(e) => setDefaultPool(e.target.value)}
          >
            <option value="SCY">SCY — Short Course Yards</option>
            <option value="SCM">SCM — Short Course Meters</option>
            <option value="LCM">LCM — Long Course Meters</option>
          </select>
        </section>

        {/* Rosters Management */}
        <section className="config-section">
          <div className="section-header">
            <h2>Rosters</h2>
            <div className="add-roster-row">
              <input
                type="text"
                className="add-roster-input"
                placeholder="New group name..."
                value={newRosterName}
                onChange={e => setNewRosterName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addRoster()}
              />
              <button
                className="config-btn add"
                onClick={addRoster}
                disabled={!newRosterName.trim()}
              >
                ➕ Add
              </button>
            </div>
          </div>

          {config.rosters.length === 0 && (
            <p className="empty-message">No rosters configured. Type a name above and click Add.</p>
          )}

          {config.rosters.map(roster => (
            <div key={roster} className="roster-card">
              <div className="roster-header">
                <input
                  type="text"
                  className="roster-name-input"
                  value={getDraftName(roster)}
                  onChange={e => onNameChange(roster, e.target.value)}
                  onBlur={() => commitRename(roster)}
                  onKeyDown={e => e.key === "Enter" && e.target.blur()}
                  title="Click to rename this group"
                />
                <button
                  className="delete-roster-btn"
                  onClick={() => deleteRoster(roster)}
                  title="Delete roster"
                >
                  ❌
                </button>
              </div>

              {/* Warmup */}
              <div className="roster-field">
                <label>Warmup:</label>
                <textarea
                  className="warmup-textarea"
                  placeholder="e.g. 400 swim&#10;4 x 100 K/S/D/S @ 2:00&#10;4 x 50 build @ :50"
                  value={config.warmups[roster] || ""}
                  onChange={(e) => updateWarmup(roster, e.target.value)}
                  rows={5}
                />
              </div>

              {/* Practice Schedule */}
              <div className="roster-field">
                <label>Practice Schedule:</label>
                <div className="schedule-grid">
                  {DOW.map(day => (
                    <div key={day} className="schedule-day">
                      <span className="day-label">{day}:</span>
                      <input
                        type="text"
                        className="time-input"
                        placeholder="HH:MM or OFF"
                        value={config.practiceSchedule[roster]?.[day] || "OFF"}
                        onChange={(e) => updateScheduleTime(roster, day, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default ConfigMaintenance;
