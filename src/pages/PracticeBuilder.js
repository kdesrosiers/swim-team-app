// src/pages/PracticeBuilder.js
import React, { useState, useMemo, useEffect } from "react";
import "./PracticeBuilder.css";
import { parseYardage } from "../utils/yardageParser";
import { exportPracticeDocx } from "../api/practices";
import { getConfig } from "../api/config";
import { handleSavePractice } from "../api/PracticeBuilder";


import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ---------- Helpers ---------- */
// Formats numbers with commas (1000 -> "1,000")
const formatYardage = (n) =>
  Number.isFinite(n) ? n.toLocaleString("en-US") : "";

// Parse ":40", "1:30", "1:05:30", or plain "90" into seconds
function parseTimeToSeconds(str) {
  if (!str) return null;
  const s = String(str).trim();

  if (s.startsWith(":")) {
    const sec = parseInt(s.slice(1), 10);
    return Number.isFinite(sec) ? sec : null;
  }
  if (s.includes(":")) {
    const parts = s.split(":").map((t) => t.trim());
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const sec = parseInt(parts[1], 10);
      return Number.isFinite(m) && Number.isFinite(sec) ? m * 60 + sec : null;
    }
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const sec = parseInt(parts[2], 10);
      return Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(sec)
        ? h * 3600 + m * 60 + sec
        : null;
    }
  }
  if (/^\d+$/.test(s)) {
    const sec = parseInt(s, 10);
    return Number.isFinite(sec) ? sec : null;
  }
  return null;
}

// Grab the first @ interval on a line (handles ":40/:45" by taking the first)
function extractFirstIntervalSeconds(line) {
  const atIdx = line.indexOf("@");
  if (atIdx === -1) return null;
  let after = line.slice(atIdx + 1).trim();
  after = after.split("/")[0].trim(); // if ":40/:45" -> take ":40"
  const token = after.split(/\s+/)[0]; // stop at first whitespace
  return parseTimeToSeconds(token);
}

// Expand innermost "N x { ... }" blocks by repetition so we can sum
function expandBlocks(text) {
  let out = text;
  const pattern = /(\d+)\s*[xX]\s*{([^{}]*)}/s; // innermost only
  while (pattern.test(out)) {
    out = out.replace(pattern, (_, n, inner) => {
      const times = parseInt(n, 10);
      if (!Number.isFinite(times) || times <= 0) return inner;
      const block = inner.trim();
      return Array(times).fill(block).join("\n");
    });
  }
  return out;
}

// Compute total seconds for a section (swim or break)
function computeSectionTimeSeconds(section) {
  if (section.type === "break") {
    return parseTimeToSeconds(section.content) || 0;
  }
  if (!section.content) return 0;

  const expanded = expandBlocks(section.content);
  let total = 0;

  for (let raw of expanded.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^break/i.test(line)) continue;

    const perRep = extractFirstIntervalSeconds(line);
    if (perRep == null) continue;

    let reps = 1;
    const repsMatch = line.match(/^(\d+)\s*[xX]\b/);
    if (repsMatch) reps = parseInt(repsMatch[1], 10);

    total += reps * perRep;
  }

  return total;
}

function formatSeconds(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// rounding helper for preview/export end clocks
function ceilToMinute(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  return s % 60 === 0 ? s : Math.ceil(s / 60) * 60;
}
function secondsFromHHMM(hhmm = "06:00") {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hhmm).trim());
  if (!m) return 0;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const s = m[3] ? Math.min(59, Math.max(0, parseInt(m[3], 10))) : 0;
  return h * 3600 + min * 60 + s;
}
function formatClock12(totalSecFromMidnight, showSeconds = false) {
  let s = ((totalSecFromMidnight % 86400) + 86400) % 86400;
  const h24 = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return showSeconds ? `${h12}:${mm}:${ss} ${ampm}` : `${h12}:${mm} ${ampm}`;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function nextStartFor(config, roster, yyyyMmDd) {
  // Uses per-roster schedule: practiceSchedule[roster][dayKey] -> "HH:MM" or "OFF"
  if (!config?.practiceSchedule || !roster || !yyyyMmDd) return null;
  const week = config.practiceSchedule[roster];
  if (!week) return null;
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  const key = DOW[d.getDay()];
  const v = week[key];
  if (!v || v === "OFF") return null;
  return v; // "HH:MM"
}

// Find the index of the "Warm Up" section (case-insensitive)
function findWarmupIndex(sections) {
  const idx = sections.findIndex(
    (s) => s.type === "swim" && String(s.name || "").trim().toLowerCase() === "warm up"
  );
  return idx >= 0 ? idx : -1;
}


/* -------------------------------- */

function PracticeBuilder() {
  // Sections state
  const [sections, setSections] = useState([
    {
      id: "1",
      name: "Warm Up",
      type: "swim",
      content: `400 Free @ 10:00
4 x 100 K/S/D/S @ 2:00
4 x 50 Build @ :50`,
    },
    { id: "2", name: "Pre-Set", type: "swim", content: "" },
    { id: "3", name: "Break", type: "break", content: "5:00" },
    { id: "4", name: "Main Set", type: "swim", content: "" },
    { id: "5", name: "Cool Down", type: "swim", content: "200 EZ @ 5:00" },
  ]);

  const [showPreview, setShowPreview] = useState(false);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over?.id);
      setSections((items) => arrayMove(items, oldIndex, newIndex));
    }
  };

  // Top controls state
  const [practiceDate, setPracticeDate] = useState(
    new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  );
  const [config, setConfig] = useState(null);
  const [rosterOptions, setRosterOptions] = useState([]);
  const [selectedRoster, setSelectedRoster] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  // default to SCM
  const [pool, setPool] = useState("SCM");
  const [saving, setSaving] = useState(false);


  // Load config once
  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfig();
        setConfig(cfg || {});
        // Roster options from config
        const rosters =
          Array.isArray(cfg?.rosters) && cfg.rosters.length
            ? cfg.rosters
            : ["Senior", "Gold/Platinum", "Yellow", "Blue"];
        setRosterOptions(rosters);

        // Choose default: config.defaultRoster -> first roster
        const initial = (cfg?.defaultRoster && rosters.includes(cfg.defaultRoster))
          ? cfg.defaultRoster
          : rosters[0];

        setSelectedRoster(initial);

        // initial Start from today's weekday for the initial (or first) roster
        const initialRoster = selectedRoster || rosters[0];
        const todayKey = DOW[new Date().getDay()];
        const maybe = cfg?.practiceSchedule?.[initialRoster]?.[todayKey];
        if (maybe && maybe !== "OFF") setStartTime(maybe);
      } catch (e) {
        console.error("Failed to load config", e);
        // sensible defaults if config not reachable
        const fallback = ["Senior", "Gold/Platinum", "Yellow", "Blue"];
        setRosterOptions(fallback);
        if (!selectedRoster) setSelectedRoster(fallback[0]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When date or roster changes and we have config, adjust startTime from schedule (if defined)
  useEffect(() => {
    const st = nextStartFor(config, selectedRoster, practiceDate);
    if (st) setStartTime(st);
  }, [config, selectedRoster, practiceDate]);

  useEffect(() => {
    if (!config?.warmups || !selectedRoster) return;
    const preset = config.warmups[selectedRoster];
    if (!preset) return;

    setSections((prev) => {
      const idx = findWarmupIndex(prev);
      if (idx === -1) return prev; // no warmup section
      const next = [...prev];
      next[idx] = { ...next[idx], content: preset };
      return next;
    });
  }, [config, selectedRoster]);

  // Live yardage & time (per section + totals)
  const sectionYardages = useMemo(
    () => sections.map((s) => (s.type === "swim" ? parseYardage(s.content) : 0)),
    [sections]
  );
  const sectionTimes = useMemo(
    () => sections.map((s) => computeSectionTimeSeconds(s)),
    [sections]
  );

  const totalYardage = sectionYardages.reduce((sum, v) => sum + v, 0);
  const totalTimeSec = sectionTimes.reduce((sum, v) => sum + v, 0);

  // Preview end clocks (rounded up to the next minute)
  const sectionEndClocks = useMemo(() => {
    let clock = secondsFromHHMM(startTime); // seconds from midnight for Start:
    return sectionTimes.map((dur) => {
      const endExact = clock + (dur || 0); // exact end (includes seconds)
      const endDisplay = ceilToMinute(endExact); // rounded UP for display
      clock = endExact; // advance by exact, not rounded
      return endDisplay; // we display the rounded value
    });
  }, [sectionTimes, startTime]);

  // helper: purely string-based (no Date())
  function formatMDY(yyyyMmDd) {
    if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return "";
    const [y, m, d] = yyyyMmDd.split("-");
    return `${m}/${d}/${y}`;
  }

  async function onSave() {
    try {
      const title = `Practice ${formatMDY(practiceDate)}${selectedRoster ? ` ${selectedRoster}` : ""}`;
      const date = practiceDate;
      const poolValue = pool;

      const sectionsForApi = sections.map((s, i) => ({
        type: s.type === "break" ? "Break" : s.type,
        title: s.name || (s.type === "break" ? "Break" : "Section"),
        text: s.content || "",
        yardage: sectionYardages[i] ?? 0,
        timeSeconds: sectionTimes[i] ?? 0,
      }));

      const totals = { yardage: totalYardage, timeSeconds: totalTimeSec };

      // ⬇️ Call the helper with the parameter names it expects.
      // (It maps sections itself, so pass raw sections + computed arrays.)
      await handleSavePractice({
        practiceTitle: title,
        practiceDate: date,
        pool: poolValue,
        selectedRoster,
        sections,            // pass raw sections; helper will map them
        sectionYardages,
        sectionTimes,
        totalYardage,
        totalTimeSec,
        // startTime is not persisted in the practice model, so we omit it here
      });

      alert("✅ Practice saved!");
    } catch (e) {
      console.error(e);
      alert("❌ Save failed. Check console.");
    }
  }

  // Export
  async function handleExportDocx() {
    try {
      const niceDate = formatMDY(practiceDate);
      const title = `Practice ${niceDate}${selectedRoster ? ` ${selectedRoster}` : ""}`;
      const poolValue = pool;

      const sectionsForApi = sections.map((s, i) => ({
        type: s.type === "break" ? "Break" : s.type,
        title: s.name || (s.type === "break" ? "Break" : "Section"),
        text: s.content || "",
        yardage: sectionYardages[i] ?? 0,
        timeSeconds: sectionTimes[i] ?? 0,
      }));

      const totals = { yardage: totalYardage, timeSeconds: totalTimeSec };

      const payload = {
        title,
        date: practiceDate,
        roster: selectedRoster,
        pool: poolValue,
        startTime,
        sections: sectionsForApi,
        totals,
      };

      const out = await exportPracticeDocx(payload);
      // server returns { filePath } — show it
      const msg = out?.filePath ? `✅ Exported to:\n${out.filePath}` : "✅ Export completed.";
      alert(msg);
    } catch (e) {
      console.error(e);
      alert("❌ Export failed. Check console.");
    }
  }

  async function onSaveAndExport() {
    if (saving) return;
    setSaving(true);
    try {
      const title = `Practice ${formatMDY(practiceDate)}${selectedRoster ? ` ${selectedRoster}` : ""}`;
      const date = practiceDate;
      const poolValue = pool;

      const sectionsForApi = sections.map((s, i) => ({
        type: s.type === "break" ? "Break" : s.type,
        title: s.name || (s.type === "break" ? "Break" : "Section"),
        text: s.content || "",
        yardage: sectionYardages[i] ?? 0,
        timeSeconds: sectionTimes[i] ?? 0,
      }));

      const totals = { yardage: totalYardage, timeSeconds: totalTimeSec };

      // 1) SAVE (use the helper so it maps and persists consistently)
      await handleSavePractice({
        practiceTitle: title,
        practiceDate: date,
        pool: poolValue,
        selectedRoster,
        sections,
        sectionYardages,
        sectionTimes,
        totalYardage,
        totalTimeSec,
      });

      // 2) EXPORT (use the already-mapped sectionsForApi and include startTime)
      const out = await exportPracticeDocx({
        title,
        date,
        roster: selectedRoster,
        pool: poolValue,
        startTime,
        sections: sectionsForApi,
        totals,
      });

      alert(`✅ Saved & exported to:\n${out.filePath}`);
    } catch (e) {
      console.error(e);
      alert("❌ Save & Export failed. Check console.");
    } finally {
      setSaving(false);
    }
  }

  // Section CRUD
  const addSwimSection = () => {
    const newId = Date.now().toString();
    setSections([...sections, { id: newId, name: "New Section", type: "swim", content: "" }]);
  };
  const addBreakSection = () => {
    const newId = Date.now().toString();
    setSections([...sections, { id: newId, name: "", type: "break", content: "" }]);
  };
  const deleteSection = (id) => {
    setSections(sections.filter((section) => section.id !== id));
  };
  const updateSection = (id, field, value) => {
    setSections(sections.map((section) => (section.id === id ? { ...section, [field]: value } : section)));
  };

  return (
    <div className="builder-page">
      <div className="app-container">
        <h1 className="header">Practice Builder</h1>

        {/* Toolbar (top bar) */}
        <div className="toolbar">
          <div className="toolbar-right">
            <label className="pair">
              <span>Date:</span>
              <input
                type="date"
                value={practiceDate}
                onChange={(e) => setPracticeDate(e.target.value)}
              />
            </label>

            <label className="pair">
              <span>Roster:</span>
              <select
                value={selectedRoster}
                onChange={(e) => setSelectedRoster(e.target.value)}
              >
                {(rosterOptions.length ? rosterOptions : ["Gold/Platinum", "Bronze"]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="pair">
              <span>Start:</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                step={60}
              />
            </label>

            <label className="pair">
              <span>Pool:</span>
              <select value={pool} onChange={(e) => setPool(e.target.value)}>
                <option value="SCM">SCM</option>
                <option value="SCY">SCY</option>
                <option value="LCM">LCM</option>
              </select>
            </label>
          </div>
        </div>

        {/* Sections (DnD) */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: "" },
            announcements: {
              onDragStart: () => "",
              onDragMove: () => "",
              onDragOver: () => "",
              onDragEnd: () => "",
              onDragCancel: () => "",
            },
          }}
        >
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section, idx) => (
              <SortableSection
                key={section.id}
                section={section}
                onChange={updateSection}
                onDelete={deleteSection}
                yardage={sectionYardages[idx]}
                timeSec={sectionTimes[idx]}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add buttons */}
        <div className="topbar">
          <div className="add-buttons">
            <button className="add-btn" onClick={addSwimSection}>+ Add Section</button>
            <button className="add-btn light" onClick={addBreakSection}>+ Add Break</button>
          </div>
          <div className="actions">
            <button className="preview-btn" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button className="preview-btn" onClick={onSave}>💾 Save Practice</button>
            <button className="preview-btn" onClick={handleExportDocx}>⬇️ Export Word</button>
            <button className="preview-btn" onClick={onSaveAndExport} disabled={saving}>
              💾⬇️ Save & Export
            </button>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="preview-panel">
            {sections.map((section, index) =>
              section.type === "break" ? (
                <div key={section.id} className="preview-break">
                  {section.name || "Break"}
                  {section.content ? ` @ ${section.content}` : ""}
                </div>
              ) : (
                <div key={section.id} className="preview-section">
                  <div className="preview-title-row">
                    <div className="preview-title-left">
                      {section.name}
                      {sectionYardages[index] > 0 ? ` – ${formatYardage(sectionYardages[index])}m` : ""}
                    </div>
                    <div className="preview-title-right">
                      {sectionTimes[index] > 0
                        ? `${formatSeconds(sectionTimes[index])} \u2192 ${formatClock12(sectionEndClocks[index], false)}`
                        : ""}
                    </div>
                  </div>

                  {section.content.split("\n").map((line, i) => (
                    <div key={i} className="preview-line">
                      {line.trim() === "" ? <br /> : line}
                    </div>
                  ))}
                </div>
              )
            )}

            <div className="preview-total-row">
              <div className="preview-total-left">
                <strong>Total: {formatYardage(totalYardage)}m</strong>
              </div>
              <div className="preview-total-right">
                <strong>{totalTimeSec > 0 ? formatSeconds(totalTimeSec) : ""}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableSection({ section, onChange, onDelete, yardage, timeSec }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="practice-section">
      {section.type === "break" ? (
        <div className="break-inline" {...attributes} {...listeners}>
          <button className="drag-handle" aria-label="Drag section" {...attributes} {...listeners}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <input
            type="text"
            className="section-name-input"
            placeholder="Break Name"
            value={section.name}
            onChange={(e) => onChange(section.id, "name", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <input
            type="text"
            className="break-input"
            placeholder="e.g. 5:00"
            value={section.content}
            onChange={(e) => onChange(section.id, "content", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />

          <button className="delete-btn" onClick={() => onDelete(section.id)}>
            ❌
          </button>
        </div>
      ) : (
        <>
          <div className="section-header" {...attributes} {...listeners}>
            <button className="drag-handle" aria-label="Drag section">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <input
              type="text"
              className="section-name-input"
              value={section.name}
              onChange={(e) => onChange(section.id, "name", e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />

            {yardage > 0 && <span className="yardage-display"> {formatYardage(yardage)}m</span>}
            {timeSec > 0 && <span className="yardage-display"> @ {formatSeconds(timeSec)}</span>}
            <button className="delete-btn" onClick={() => onDelete(section.id)}>
              ❌
            </button>
          </div>

          <textarea
            className="practice-input"
            placeholder="e.g. 3x100 Free @ 1:30"
            value={section.content}
            onChange={(e) => onChange(section.id, "content", e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation(); // keep space/tab working inside textarea
              if (e.key === "Tab") {
                e.preventDefault();
                const el = e.target;
                const { selectionStart, selectionEnd } = el;
                const updated =
                  section.content.slice(0, selectionStart) +
                  "\t" +
                  section.content.slice(selectionEnd);
                onChange(section.id, "content", updated);
                setTimeout(() => {
                  el.selectionStart = el.selectionEnd = selectionStart + 1;
                }, 0);
              }
            }}
          />
        </>
      )}
    </div>
  );
}

export default PracticeBuilder;
