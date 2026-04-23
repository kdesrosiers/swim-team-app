import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  listTimeStandards,
  createTimeStandards,
  updateTimeStandards,
  deleteTimeStandards,
} from "../api/timeStandards";
import { convertTime } from "../utils/swimTimeConversion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./TimeStandards.css";

const DEFAULT_EVENTS = [
  "50 Free", "100 Free", "200 Free", "500/400 Free", "1000/800 Free", "1650/1500 Free",
  "50 Back", "100 Back", "200 Back",
  "50 Breast", "100 Breast", "200 Breast",
  "50 Fly", "100 Fly", "200 Fly",
  "100 IM", "200 IM", "400 IM",
  "200 Free Relay", "400 Free Relay", "800 Free Relay",
  "200 Medley Relay", "400 Medley Relay",
];

const DISTANCES = ["50", "100", "200", "400", "500/400", "800", "1000/800", "1650/1500"];
const STROKES   = ["Free", "Back", "Breast", "Fly", "IM", "Free Relay", "Medley Relay"];

const AGE_GROUPS = ["8 & Under", "9-10", "11-12", "13-14", "15-18", "Open"];

// Table column order matching the image: Women left → Men right (mirrored)
const WOMEN_COURSES = ["SCM", "SCY", "LCM"];
const MEN_COURSES   = ["LCM", "SCY", "SCM"];

const COURSE_LABELS = { SCY: "25 Yard Course", SCM: "25 Meter Course", LCM: "50 Meter Course" };

function cutKey(gender, course, level) {
  return `${gender}:${course}:${level}`;
}

// Parse "100 Free" → { stroke: "FREE", distance: 100 }
// Parse "200 Free Relay" → { stroke: "FREE_RELAY", distance: 200 }
const STROKE_MAP = { free: "FREE", back: "BACK", breast: "BREAST", fly: "FLY", im: "IM" };
function parseEventInfo(eventName) {
  const parts = eventName.trim().split(/\s+/);
  const distance = parseInt(parts[0], 10);
  // Relay events: last word is "Relay", second-to-last is the stroke type
  if (parts[parts.length - 1].toLowerCase() === "relay") {
    const relayType = parts[parts.length - 2].toLowerCase();
    const stroke = relayType === "medley" ? "MEDLEY_RELAY" : "FREE_RELAY";
    return { distance, stroke };
  }
  const strokeWord = parts[parts.length - 1].toLowerCase();
  const stroke = STROKE_MAP[strokeWord] || null;
  return { distance, stroke };
}

function blankSet() {
  return { name: "", organization: "", standardLevels: ["AAAA", "AAA", "AA", "A", "BB", "B"] };
}

export default function TimeStandards() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New-set form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSet, setNewSet] = useState(blankSet());
  const [newLevelsInput, setNewLevelsInput] = useState("AAAA, AAA, AA, A, BB, B");

  // Header edit fields
  const [editName, setEditName] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editLevels, setEditLevels] = useState("");

  // Table filters
  const [filterAgeGroup, setFilterAgeGroup] = useState("11-12");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterCourse, setFilterCourse] = useState("SCY");

  // Flip mode: tabs = courses, columns = levels
  const [flipped, setFlipped] = useState(false);

  // Auto-conversion toggle
  const [autoConvert, setAutoConvert] = useState(true);

  // Add-event form
  const [newEventDist, setNewEventDist] = useState("100");
  const [newEventStroke, setNewEventStroke] = useState("Free");

  // Pending cell edits: { "event|ageGroup": { "F:SCY:AA": "1:23.45", ... } }
  const [pendingEdits, setPendingEdits] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listTimeStandards();
      setSets(data);
    } catch {
      toast.error("Failed to load time standards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectSet(s) {
    setSelected(s);
    setEditName(s.name);
    setEditOrg(s.organization || "");
    setEditLevels((s.standardLevels || []).join(", "));
    setFilterLevel((s.standardLevels || [])[0] || "");
    setPendingEdits({});
    setShowNewForm(false);
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreateSet(e) {
    e.preventDefault();
    if (!newSet.name.trim()) return toast.error("Name is required");
    try {
      setSaving(true);
      const levels = newLevelsInput.split(",").map(s => s.trim()).filter(Boolean);
      const created = await createTimeStandards({ ...newSet, standardLevels: levels, events: DEFAULT_EVENTS, entries: [] });
      const updated = [created, ...sets].sort((a, b) => a.name.localeCompare(b.name));
      setSets(updated);
      setShowNewForm(false);
      setNewSet(blankSet());
      setNewLevelsInput("AAAA, AAA, AA, A, BB, B");
      selectSet(created);
      toast.success("Set created");
    } catch (e) {
      toast.error(e.message || "Failed to create set");
    } finally {
      setSaving(false);
    }
  }

  // ── Save header ─────────────────────────────────────────────────────────────
  async function handleSaveHeader() {
    if (!selected) return;
    try {
      setSaving(true);
      const levels = editLevels.split(",").map(s => s.trim()).filter(Boolean);
      const updated = await updateTimeStandards(selected._id, {
        name: editName, organization: editOrg, standardLevels: levels,
      });
      setSets(prev => prev.map(s => s._id === updated._id ? updated : s).sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(updated);
      if (!levels.includes(filterLevel)) setFilterLevel(levels[0] || "");
      toast.success("Saved");
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── Add / Remove events ─────────────────────────────────────────────────────
  async function handleAddEvent() {
    if (!selected) return;
    const label = `${newEventDist} ${newEventStroke}`;
    const currentEvents = selected.events != null ? selected.events : DEFAULT_EVENTS;
    if (currentEvents.includes(label)) return toast.error("Event already exists");
    const updatedEvents = [...currentEvents, label];
    try {
      const result = await updateTimeStandards(selected._id, { events: updatedEvents });
      setSets(prev => prev.map(s => s._id === result._id ? result : s));
      setSelected(result);
    } catch (e) {
      toast.error(e.message || "Failed to add event");
    }
  }

  async function handleRemoveEvent(ev) {
    if (!selected) return;
    const currentEvents = selected.events != null ? selected.events : DEFAULT_EVENTS;
    const updatedEvents = currentEvents.filter(e => e !== ev);
    const updatedEntries = (selected.entries || []).filter(e => e.event !== ev);
    try {
      const result = await updateTimeStandards(selected._id, { events: updatedEvents, entries: updatedEntries });
      setSets(prev => prev.map(s => s._id === result._id ? result : s));
      setSelected(result);
      // also drop pending edits for this event
      setPendingEdits(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(`${ev}|`)) delete next[k]; });
        return next;
      });
    } catch (e) {
      toast.error(e.message || "Failed to remove event");
    }
  }

  // ── Delete set ──────────────────────────────────────────────────────────────
  async function handleDeleteSet() {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.name}"? This cannot be undone.`)) return;
    try {
      await deleteTimeStandards(selected._id);
      setSets(prev => prev.filter(s => s._id !== selected._id));
      setSelected(null);
      toast.success("Deleted");
    } catch (e) {
      toast.error(e.message || "Failed to delete");
    }
  }

  // ── Cell helpers ────────────────────────────────────────────────────────────
  function rowKey(event, ageGroup) { return `${event}|${ageGroup}`; }

  // In normal mode columns=courses, tab=level; in flipped mode columns=levels, tab=course
  function getCellValue(event, ageGroup, gender, colValue) {
    const key = flipped
      ? cutKey(gender, filterCourse, colValue)
      : cutKey(gender, colValue, filterLevel);
    const rk = rowKey(event, ageGroup);
    if (pendingEdits[rk] && pendingEdits[rk][key] !== undefined) return pendingEdits[rk][key];
    const entry = (selected?.entries || []).find(e => e.event === event && e.ageGroup === ageGroup);
    return entry?.cuts?.[key] ?? "";
  }

  function setCellEdit(event, ageGroup, gender, colValue, value) {
    const key = flipped
      ? cutKey(gender, filterCourse, colValue)
      : cutKey(gender, colValue, filterLevel);
    const rk = rowKey(event, ageGroup);
    setPendingEdits(prev => ({
      ...prev,
      [rk]: { ...(prev[rk] || {}), [key]: value },
    }));
  }

  // ── Auto-convert on blur (normal mode only) ─────────────────────────────────
  function handleCellBlur(event, ageGroup, gender, enteredCourse, value) {
    if (!autoConvert || flipped || !value.trim()) return;

    const { stroke, distance } = parseEventInfo(event);
    if (!stroke) return;

    const otherCourses = ["SCY", "SCM", "LCM"].filter(c => c !== enteredCourse);
    const rk = rowKey(event, ageGroup);

    setPendingEdits(prev => {
      const rowEdits = { ...(prev[rk] || {}) };
      let changed = false;

      otherCourses.forEach(targetCourse => {
        const targetKey = cutKey(gender, targetCourse, filterLevel);
        // Don't overwrite a cell the user has already manually edited or that has saved data
        const alreadyPending = rowEdits[targetKey] !== undefined;
        const entry = (selected?.entries || []).find(e => e.event === event && e.ageGroup === ageGroup);
        const alreadySaved = entry?.cuts?.[targetKey];
        if (alreadyPending || alreadySaved) return;

        try {
          const result = convertTime(value.trim(), enteredCourse, targetCourse, stroke, distance);
          if (result.convertedTime) {
            rowEdits[targetKey] = result.convertedTime;
            changed = true;
          }
        } catch {
          // silently skip if conversion fails (e.g. unsupported event)
        }
      });

      return changed ? { ...prev, [rk]: rowEdits } : prev;
    });
  }

  // ── Save entries ────────────────────────────────────────────────────────────
  async function handleSaveEntries() {
    if (!selected || !hasPending) return;
    try {
      setSaving(true);
      const updatedEntries = [...(selected.entries || [])];

      Object.entries(pendingEdits).forEach(([rk, cuts]) => {
        const [event, ageGroup] = rk.split("|");
        const idx = updatedEntries.findIndex(e => e.event === event && e.ageGroup === ageGroup);
        if (idx >= 0) {
          updatedEntries[idx] = {
            ...updatedEntries[idx],
            cuts: { ...updatedEntries[idx].cuts, ...cuts },
          };
        } else {
          updatedEntries.push({ event, ageGroup, cuts });
        }
      });

      const result = await updateTimeStandards(selected._id, { entries: updatedEntries });
      setSets(prev => prev.map(s => s._id === result._id ? result : s));
      setSelected(result);
      setPendingEdits({});
      toast.success("Saved");
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── Export PDF ──────────────────────────────────────────────────────────────
  function handleExportPdf() {
    if (!selected) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

    const colCols = flipped ? WOMEN_LEVELS : WOMEN_COURSES;
    const menCols = flipped ? MEN_LEVELS   : MEN_COURSES;
    const colCount = colCols.length; // always 3

    // Title
    const title = `${selected.name}${selected.organization ? ` — ${selected.organization}` : ""}`;
    const subtitle = flipped
      ? `Course: ${filterCourse}  |  Age Group: ${filterAgeGroup}`
      : `Standard: ${filterLevel}  |  Age Group: ${filterAgeGroup}`;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, doc.internal.pageSize.width / 2, 36, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, doc.internal.pageSize.width / 2, 50, { align: "center" });

    // Column headers
    const subHead = [
      ...colCols.map(c => flipped ? c : COURSE_LABELS[c]),
      "Event",
      ...menCols.map(c => flipped ? c : COURSE_LABELS[c]),
    ];

    // Body rows
    const body = activeEvents.map(ev => {
      const wCells = colCols.map(col => getCellValue(ev, filterAgeGroup, "F", col) || "—");
      const mCells = menCols.map(col => getCellValue(ev, filterAgeGroup, "M", col) || "—");
      return [...wCells, ev, ...mCells];
    });

    const totalCols = colCount + 1 + colCount; // women + event + men
    const marginX = 40;
    const pageW = doc.internal.pageSize.width - marginX * 2;
    const eventColW = 110;
    const dataColW = (pageW - eventColW) / (colCount * 2);
    const colWidths = [
      ...Array(colCount).fill(dataColW),
      eventColW,
      ...Array(colCount).fill(dataColW),
    ];

    // Draw WOMEN / MEN group header boxes above the table
    const groupY = 62;
    const groupH = 14;
    const wW = dataColW * colCount;
    const mW = dataColW * colCount;
    doc.setFillColor(240, 249, 255);
    doc.rect(marginX, groupY, wW, groupH, "F");
    doc.setFillColor(254, 252, 232);
    doc.rect(marginX + wW + eventColW, groupY, mW, groupH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(3, 105, 161);
    doc.text("WOMEN", marginX + wW / 2, groupY + 9.5, { align: "center" });
    doc.setTextColor(146, 64, 14);
    doc.text("MEN", marginX + wW + eventColW + mW / 2, groupY + 9.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: groupY + groupH,
      head: [subHead],
      body,
      columnStyles: Object.fromEntries(
        Array.from({ length: totalCols }, (_, i) => [i, {
          halign: "center",
          fontStyle: i === colCount ? "bold" : "normal",
          cellWidth: colWidths[i],
        }])
      ),
      headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: marginX, right: marginX },
    });

    const safeName = selected.name.replace(/[^a-z0-9]/gi, "_");
    doc.save(`${safeName}_${filterAgeGroup.replace(/\s/g, "")}_${flipped ? filterCourse : filterLevel}.pdf`);
  }

  const hasPending = Object.keys(pendingEdits).length > 0;
  const levels = selected?.standardLevels || [];
  const canFlip = levels.length > 1;
  const activeEvents = selected
    ? (selected.events != null ? selected.events : DEFAULT_EVENTS)
    : DEFAULT_EVENTS;

  // In flipped mode: columns are levels (mirrored for men), tabs are courses
  const WOMEN_LEVELS = levels;
  const MEN_LEVELS = [...levels].reverse();

  return (
    <div className="ts-page">
      {/* Sidebar */}
      <aside className="ts-sidebar">
        <div className="ts-sidebar-header">
          <h2>Time Standards</h2>
          <button className="ts-btn-primary ts-btn-sm" onClick={() => { setShowNewForm(true); setSelected(null); }}>
            + New
          </button>
        </div>
        {loading ? (
          <p className="ts-sidebar-empty">Loading…</p>
        ) : sets.length === 0 ? (
          <p className="ts-sidebar-empty">No sets yet.</p>
        ) : (
          <ul className="ts-set-list">
            {sets.map(s => (
              <li key={s._id} className={`ts-set-item${selected?._id === s._id ? " active" : ""}`} onClick={() => selectSet(s)}>
                <span className="ts-set-name">{s.name}</span>
                {s.organization && <span className="ts-set-meta">{s.organization}</span>}
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Main */}
      <main className="ts-main">

        {/* New set form */}
        {showNewForm && (
          <div className="ts-panel">
            <h3>New Time Standards Set</h3>
            <form onSubmit={handleCreateSet} className="ts-form">
              <div className="ts-field-row">
                <label>Name <span className="req">*</span>
                  <input value={newSet.name} onChange={e => setNewSet(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. 2024-25 USA Swimming Motivational" required />
                </label>
                <label>Organization
                  <input value={newSet.organization} onChange={e => setNewSet(p => ({ ...p, organization: e.target.value }))}
                    placeholder="e.g. USA Swimming" />
                </label>
              </div>
              <label>Standard Levels (comma-separated, fastest first)
                <input value={newLevelsInput} onChange={e => setNewLevelsInput(e.target.value)}
                  placeholder="AAAA, AAA, AA, A, BB, B" />
              </label>
              <div className="ts-form-actions">
                <button type="submit" className="ts-btn-primary" disabled={saving}>Create Set</button>
                <button type="button" className="ts-btn-ghost" onClick={() => setShowNewForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Selected set */}
        {selected && !showNewForm && (
          <>
            {/* Header editor */}
            <div className="ts-panel ts-header-panel">
              <div className="ts-form">
                <div className="ts-field-row">
                  <label>Name
                    <input value={editName} onChange={e => setEditName(e.target.value)} />
                  </label>
                  <label>Organization
                    <input value={editOrg} onChange={e => setEditOrg(e.target.value)} placeholder="Optional" />
                  </label>
                  <label>Standard Levels (comma-separated, fastest → slowest)
                    <input value={editLevels} onChange={e => setEditLevels(e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="ts-header-actions">
                <button className="ts-btn-primary" onClick={handleSaveHeader} disabled={saving}>Save Changes</button>
                <button className="ts-btn-danger" onClick={handleDeleteSet}>Delete Set</button>
              </div>
            </div>

            {/* Filters */}
            <div className="ts-filters-row">
              <div className="ts-filter-group">
                <span className="ts-filter-label">Age Group</span>
                <select value={filterAgeGroup} onChange={e => setFilterAgeGroup(e.target.value)}>
                  {AGE_GROUPS.map(ag => <option key={ag}>{ag}</option>)}
                </select>
              </div>

              {/* Tabs: Standard levels (normal) or Courses (flipped) */}
              <div className="ts-filter-group">
                <span className="ts-filter-label">{flipped ? "Course" : "Standard"}</span>
                <div className="ts-level-tabs">
                  {flipped
                    ? ["SCY", "SCM", "LCM"].map(c => (
                        <button key={c} className={`ts-level-tab${filterCourse === c ? " active" : ""}`}
                          onClick={() => setFilterCourse(c)}>
                          {c}
                        </button>
                      ))
                    : levels.map(l => (
                        <button key={l} className={`ts-level-tab${filterLevel === l ? " active" : ""}`}
                          onClick={() => setFilterLevel(l)}>
                          {l}
                        </button>
                      ))
                  }
                </div>
              </div>

              {canFlip && (
                <button
                  className={`ts-btn-ghost ts-btn-sm ts-flip-btn${flipped ? " active" : ""}`}
                  onClick={() => setFlipped(f => !f)}
                  title={flipped ? "Show courses as columns, filter by standard" : "Show standards as columns, filter by course"}
                >
                  ⇄ {flipped ? "By Course" : "By Standard"}
                </button>
              )}

              {!flipped && (
                <label className="ts-toggle-label" title="Automatically fill the other two course columns when you enter a time">
                  <span className="ts-filter-label">Auto-convert</span>
                  <div className={`ts-toggle${autoConvert ? " on" : ""}`} onClick={() => setAutoConvert(v => !v)}>
                    <div className="ts-toggle-knob" />
                  </div>
                </label>
              )}

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {hasPending && (
                  <button className="ts-btn-primary ts-btn-sm" onClick={handleSaveEntries} disabled={saving}>
                    Save
                  </button>
                )}
                <button className="ts-btn-ghost ts-btn-sm" onClick={handleExportPdf}>
                  Export PDF
                </button>
              </div>
            </div>

            {/* The cut table */}
            <div className="ts-panel ts-table-panel">
              <div className="ts-table-wrap">
                <table className="ts-table">
                  <thead>
                    <tr className="ts-head-group">
                      <th colSpan={flipped ? WOMEN_LEVELS.length : 3} className="ts-group-header ts-women">WOMEN</th>
                      <th className="ts-event-col"></th>
                      <th colSpan={flipped ? MEN_LEVELS.length : 3} className="ts-group-header ts-men">MEN</th>
                      <th className="ts-remove-col"></th>
                    </tr>
                    <tr className="ts-head-courses">
                      {(flipped ? WOMEN_LEVELS : WOMEN_COURSES).map(col => (
                        <th key={`w-${col}`} className="ts-course-col">
                          {flipped ? col : COURSE_LABELS[col]}
                        </th>
                      ))}
                      <th className="ts-event-col"></th>
                      {(flipped ? MEN_LEVELS : MEN_COURSES).map(col => (
                        <th key={`m-${col}`} className="ts-course-col">
                          {flipped ? col : COURSE_LABELS[col]}
                        </th>
                      ))}
                      <th className="ts-remove-col"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEvents.map(ev => (
                      <tr key={ev}>
                        {(flipped ? WOMEN_LEVELS : WOMEN_COURSES).map(col => (
                          <td key={`w-${col}`} className="ts-cut-cell">
                            <input
                              className="ts-cut-input"
                              value={getCellValue(ev, filterAgeGroup, "F", col)}
                              onChange={e => setCellEdit(ev, filterAgeGroup, "F", col, e.target.value)}
                              onBlur={e => !flipped && handleCellBlur(ev, filterAgeGroup, "F", col, e.target.value)}
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td className="ts-event-cell">{ev}</td>
                        {(flipped ? MEN_LEVELS : MEN_COURSES).map(col => (
                          <td key={`m-${col}`} className="ts-cut-cell">
                            <input
                              className="ts-cut-input"
                              value={getCellValue(ev, filterAgeGroup, "M", col)}
                              onChange={e => setCellEdit(ev, filterAgeGroup, "M", col, e.target.value)}
                              onBlur={e => !flipped && handleCellBlur(ev, filterAgeGroup, "M", col, e.target.value)}
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td className="ts-remove-col">
                          <button className="ts-remove-event-btn" onClick={() => handleRemoveEvent(ev)} title="Remove event">×</button>
                        </td>
                      </tr>
                    ))}
                    {/* Add event row */}
                    <tr className="ts-add-event-row">
                      <td colSpan={(flipped ? WOMEN_LEVELS.length : 3) + 1 + (flipped ? MEN_LEVELS.length : 3)} className="ts-add-event-cell">
                        <div className="ts-add-event-form">
                          <select value={newEventDist} onChange={e => setNewEventDist(e.target.value)} className="ts-add-select">
                            {DISTANCES.map(d => <option key={d}>{d}</option>)}
                          </select>
                          <select value={newEventStroke} onChange={e => setNewEventStroke(e.target.value)} className="ts-add-select">
                            {STROKES.map(s => <option key={s}>{s}</option>)}
                          </select>
                          <button className="ts-btn-primary ts-btn-sm" onClick={handleAddEvent}>+ Add Event</button>
                        </div>
                      </td>
                      <td className="ts-remove-col"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {hasPending && (
                <div className="ts-save-bar">
                  <button className="ts-btn-primary" onClick={handleSaveEntries} disabled={saving}>Save Entries</button>
                  <span className="ts-unsaved-note">Unsaved changes</span>
                </div>
              )}
            </div>
          </>
        )}

        {!selected && !showNewForm && (
          <div className="ts-empty-state">
            <p>Select a time standards set from the sidebar, or create a new one.</p>
          </div>
        )}
      </main>

      <button className="ts-back-btn" onClick={() => navigate("/home/coaches")}>
        ← Coaches Tools
      </button>
    </div>
  );
}
