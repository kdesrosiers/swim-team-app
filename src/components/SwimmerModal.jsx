import React, { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { formatTime, parseSwimTime } from "../utils/formatTime";
import { addTime, updateTime, deleteTime, updateSwimmer, calculateAge } from "../api/swimmers";

// ── Event definitions ──────────────────────────────────────────────────────
const STROKES = [
  {
    label: "Freestyle",
    events: ["50 Free", "100 Free", "200 Free", "500 Free", "1000 Free", "1650 Free"],
  },
  {
    label: "Backstroke",
    events: ["50 Back", "100 Back", "200 Back"],
  },
  {
    label: "Breaststroke",
    events: ["50 Breast", "100 Breast", "200 Breast"],
  },
  {
    label: "Butterfly",
    events: ["50 Fly", "100 Fly", "200 Fly"],
  },
  {
    label: "Ind. Medley",
    events: ["100 IM", "200 IM", "400 IM"],
  },
];

const ALL_EVENTS = STROKES.flatMap(s => s.events);
const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

function isRecentPR(dateStr) {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < SIXTY_DAYS;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDob(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Main component ──────────────────────────────────────────────────────────
function SwimmerModal({
  swimmer,
  activeTab,
  setActiveTab,
  activeCourse,
  setActiveCourse,
  onClose,
  onUpdate,
}) {
  const backdropRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleBackdrop(e) {
    if (e.target === backdropRef.current) onClose();
  }

  const color = swimmer.group?.color || "#4f46e5";
  const age   = calculateAge(swimmer.dob);
  const initials = `${swimmer.firstName.charAt(0)}${swimmer.lastName.charAt(0)}`.toUpperCase();

  // Times filtered by active course
  const courseTimes = (swimmer.bestTimes || []).filter(t => t.course === activeCourse);
  const courseCount = courseTimes.length;

  // Build lookup: event → best isBest entry for active course
  const bestLookup = {};
  courseTimes.forEach(t => {
    if (t.isBest || !bestLookup[t.event]) {
      bestLookup[t.event] = t;
    }
  });

  const TABS = ["info", "times", "results", "notes"];
  const TAB_LABELS = {
    info:    "Personal Info",
    times:   "Best Times",
    results: "Meet Results",
    notes:   "Notes",
  };

  return (
    <div className="sm-backdrop" ref={backdropRef} onClick={handleBackdrop}>
      <div className="sm-panel" role="dialog" aria-modal="true">

        {/* ── Modal header ─────────────────────────────────────────── */}
        <div className="sm-header">
          <div className="sm-header-top">
            <div className="sm-avatar" style={{ background: color }}>
              {initials}
            </div>
            <div className="sm-header-info">
              <h2 className="sm-name">
                {swimmer.firstName} {swimmer.lastName}
              </h2>
              <div className="sm-header-meta">
                {swimmer.group && (
                  <span
                    className="sm-group-badge"
                    style={{
                      background: `${color}22`,
                      color,
                      borderColor: `${color}55`,
                    }}
                  >
                    {swimmer.group.name}
                  </span>
                )}
                {age != null && (
                  <span className="sm-meta-chip">Age {age}</span>
                )}
                {swimmer.usaSwimmingId && (
                  <span className="sm-meta-chip sm-usa-id">
                    {swimmer.usaSwimmingId}
                  </span>
                )}
              </div>
            </div>
            <button className="sm-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          {/* Tab bar */}
          <div className="sm-tabs" role="tablist">
            {TABS.map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`sm-tab${activeTab === tab ? " sm-tab--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Modal body (scrollable) ───────────────────────────────── */}
        <div className="sm-body">
          {activeTab === "info"    && <TabInfo    swimmer={swimmer} age={age} />}
          {activeTab === "times"   && (
            <TabTimes
              swimmer={swimmer}
              activeCourse={activeCourse}
              setActiveCourse={setActiveCourse}
              courseCount={courseCount}
              bestLookup={bestLookup}
              onUpdate={onUpdate}
            />
          )}
          {activeTab === "results" && <TabResults />}
          {activeTab === "notes"   && <TabNotes swimmer={swimmer} onUpdate={onUpdate} />}
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Personal Info ────────────────────────────────────────────────────
function TabInfo({ swimmer, age }) {
  const c = swimmer.contact || {};
  return (
    <div className="tab-info">
      <div className="ti-grid">
        <Cell label="First name"  value={swimmer.firstName} />
        <Cell label="Last name"   value={swimmer.lastName} />
        <Cell label="Date of birth" value={formatDob(swimmer.dob)} />
        <Cell label="Age"         value={age ?? "—"} />
        <Cell label="Gender"      value={swimmer.gender || "—"} />
        <Cell label="Grad year"   value={swimmer.graduationYear || "—"} />
        <Cell label="USA Swimming ID" value={swimmer.usaSwimmingId || "—"} fullWidth />

        <div className="ti-divider" />
        <div className="ti-section-label">Contact</div>

        <Cell label="Guardian name" value={c.guardianName || "—"} />
        <Cell label="Phone"         value={c.phone || "—"} />
        <Cell label="Guardian email" value={c.guardianEmail || "—"} fullWidth link />
      </div>
    </div>
  );
}

function Cell({ label, value, fullWidth, link }) {
  return (
    <div className={`ti-cell${fullWidth ? " ti-cell--full" : ""}`}>
      <span className="ti-label">{label}</span>
      {link && value && value !== "—" ? (
        <a className="ti-value ti-link" href={`mailto:${value}`}>{value}</a>
      ) : (
        <span className="ti-value">{value}</span>
      )}
    </div>
  );
}

// ── Tab 2: Best Times ───────────────────────────────────────────────────────
function TabTimes({ swimmer, activeCourse, setActiveCourse, courseCount, bestLookup, onUpdate }) {
  const [addingEvent, setAddingEvent]   = useState(null);  // event string or null
  const [addForm, setAddForm]           = useState({ time: "", meetName: "", date: "" });
  const [saving, setSaving]             = useState(false);

  async function handleAddSave(event) {
    const parsed = parseSwimTime(addForm.time);
    if (!parsed) { toast.error("Enter a valid time (e.g. 1:03.45 or 59.43)"); return; }
    setSaving(true);
    try {
      const updated = await addTime(swimmer._id, {
        event,
        course: activeCourse,
        time: parsed,
        meetName: addForm.meetName || undefined,
        date: addForm.date || undefined,
      });
      onUpdate(updated);
      setAddingEvent(null);
      setAddForm({ time: "", meetName: "", date: "" });
      toast.success("Time added");
    } catch {
      toast.error("Failed to add time");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tab-times">
      {/* Course toggle */}
      <div className="tt-course-row">
        <div className="tt-course-toggle">
          {["SCY", "SCM", "LCM"].map(c => (
            <button
              key={c}
              className={`tt-course-btn${activeCourse === c ? " tt-course-btn--active" : ""}`}
              onClick={() => setActiveCourse(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {courseCount > 0 && (
          <span className="tt-count">{courseCount} time{courseCount !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Stroke group tables */}
      <table className="tt-table">
        <thead>
          <tr>
            <th className="tt-th tt-col-event">Event</th>
            <th className="tt-th tt-col-time">Best Time</th>
            <th className="tt-th tt-col-meet">Meet</th>
            <th className="tt-th tt-col-date">Date</th>
            <th className="tt-th tt-col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {STROKES.map(stroke => (
            <React.Fragment key={stroke.label}>
              {/* Stroke header */}
              <tr className="tt-stroke-header">
                <td colSpan={5}>{stroke.label.toUpperCase()}</td>
              </tr>

              {stroke.events.map(event => {
                const entry = bestLookup[event];
                const isAdding = addingEvent === `${event}||${activeCourse}`;

                return (
                  <React.Fragment key={event}>
                    <EventRow
                      event={event}
                      entry={entry}
                      swimmer={swimmer}
                      activeCourse={activeCourse}
                      onUpdate={onUpdate}
                      onStartAdd={() => {
                        setAddingEvent(`${event}||${activeCourse}`);
                        setAddForm({ time: "", meetName: "", date: "" });
                      }}
                    />
                    {isAdding && (
                      <tr className="tt-add-row">
                        <td colSpan={5}>
                          <AddTimeForm
                            form={addForm}
                            setForm={setAddForm}
                            saving={saving}
                            onSave={() => handleAddSave(event)}
                            onCancel={() => setAddingEvent(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* + Add time button */}
      <div className="tt-add-section">
        <AddTimeFreeform
          swimmer={swimmer}
          activeCourse={activeCourse}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  );
}

function EventRow({ event, entry, swimmer, activeCourse, onUpdate, onStartAdd }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ time: "", meetName: "", date: "" });
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditForm({
      time: entry ? formatTime(entry.time) : "",
      meetName: entry?.meetName || "",
      date: entry?.date ? new Date(entry.date).toISOString().split("T")[0] : "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    const parsed = parseSwimTime(editForm.time);
    if (!parsed) { toast.error("Invalid time"); return; }
    setSaving(true);
    try {
      const updated = await updateTime(swimmer._id, entry._id, {
        time: parsed,
        meetName: editForm.meetName || undefined,
        date: editForm.date || undefined,
      });
      onUpdate(updated);
      setEditing(false);
      toast.success("Time updated");
    } catch {
      toast.error("Failed to update time");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setSaving(true);
    try {
      const updated = await deleteTime(swimmer._id, entry._id);
      onUpdate(updated);
      toast.success("Time deleted");
    } catch {
      toast.error("Failed to delete time");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="tt-edit-row">
        <td className="tt-td tt-col-event">{event}</td>
        <td colSpan={4}>
          <AddTimeForm
            form={editForm}
            setForm={setEditForm}
            saving={saving}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className={`tt-row${entry ? "" : " tt-row--empty"}`}>
      <td className="tt-td tt-col-event">{event}</td>
      <td className="tt-td tt-col-time">
        {entry ? (
          <span className="tt-time">
            <span className="tt-time-val">{formatTime(entry.time)}</span>
            {entry.isBest && isRecentPR(entry.date) && (
              <span className="tt-pr">PR</span>
            )}
          </span>
        ) : (
          <span className="tt-empty-dash">—</span>
        )}
      </td>
      <td className="tt-td tt-col-meet">
        <span className="tt-meta">{entry?.meetName || ""}</span>
      </td>
      <td className="tt-td tt-col-date">
        <span className="tt-meta">{entry?.date ? formatDate(entry.date) : ""}</span>
      </td>
      <td className="tt-td tt-col-actions">
        {entry ? (
          <div className="tt-actions">
            <button className="tt-btn-icon" title="Edit" onClick={startEdit} disabled={saving}>✏️</button>
            <button className="tt-btn-icon" title="Delete" onClick={handleDelete} disabled={saving}>🗑</button>
          </div>
        ) : (
          <button className="tt-btn-add-event" onClick={onStartAdd} title={`Add ${event}`}>+</button>
        )}
      </td>
    </tr>
  );
}

function AddTimeForm({ form, setForm, saving, onSave, onCancel }) {
  return (
    <div className="tt-inline-form">
      <input
        className="tt-input tt-input--time"
        placeholder="1:03.45"
        value={form.time}
        onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
        autoFocus
      />
      <input
        className="tt-input tt-input--meet"
        placeholder="Meet name"
        value={form.meetName}
        onChange={e => setForm(f => ({ ...f, meetName: e.target.value }))}
      />
      <input
        className="tt-input tt-input--date"
        type="date"
        value={form.date}
        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
      />
      <button className="tt-btn-save" onClick={onSave} disabled={saving}>
        {saving ? "…" : "Save"}
      </button>
      <button className="tt-btn-cancel" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </div>
  );
}

/** A separate "Add any time" button at the bottom of the tab */
function AddTimeFreeform({ swimmer, activeCourse, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ event: ALL_EVENTS[0], time: "", meetName: "", date: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsed = parseSwimTime(form.time);
    if (!parsed) { toast.error("Enter a valid time"); return; }
    setSaving(true);
    try {
      const updated = await addTime(swimmer._id, {
        event: form.event,
        course: activeCourse,
        time: parsed,
        meetName: form.meetName || undefined,
        date: form.date || undefined,
      });
      onUpdate(updated);
      setOpen(false);
      setForm({ event: ALL_EVENTS[0], time: "", meetName: "", date: "" });
      toast.success("Time added");
    } catch {
      toast.error("Failed to add time");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="tt-btn-add-time" onClick={() => setOpen(true)}>
        + Add time
      </button>
    );
  }

  return (
    <div className="tt-freeform">
      <select
        className="tt-input tt-input--event"
        value={form.event}
        onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
      >
        {ALL_EVENTS.map(ev => <option key={ev} value={ev}>{ev} ({activeCourse})</option>)}
      </select>
      <AddTimeForm
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

// ── Tab 3: Meet Results ─────────────────────────────────────────────────────
function TabResults() {
  return (
    <div className="tab-results">
      <p className="tr-placeholder">
        Meet results will appear here once results are imported.
      </p>
    </div>
  );
}

// ── Tab 4: Notes ────────────────────────────────────────────────────────────
function TabNotes({ swimmer, onUpdate }) {
  const [notes, setNotes] = useState(swimmer.notes || "");
  const [saved, setSaved] = useState(false);
  const timerRef = useRef(null);

  // Keep notes in sync when modal re-renders with a different swimmer
  useEffect(() => { setNotes(swimmer.notes || ""); }, [swimmer._id, swimmer.notes]);

  const saveNotes = useCallback(async (value) => {
    try {
      const updated = await updateSwimmer(swimmer._id, { notes: value });
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save notes");
    }
  }, [swimmer._id, onUpdate]);

  function handleChange(e) {
    const val = e.target.value;
    setNotes(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveNotes(val), 800);
  }

  return (
    <div className="tab-notes">
      <label className="tn-label">Private coach notes</label>
      <textarea
        className="tn-textarea"
        rows={6}
        value={notes}
        onChange={handleChange}
        placeholder="Add notes about this swimmer…"
      />
      {saved && <span className="tn-saved">Saved</span>}
    </div>
  );
}

export default SwimmerModal;
