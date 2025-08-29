// src/pages/PracticeBuilder.js
import React, { useState, useMemo } from 'react';
import './PracticeBuilder.css';
import { parseYardage } from '../utils/yardageParser';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ---------- Helpers ---------- */
// Formats numbers with commas (1000 -> "1,000")
const formatYardage = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '');

// Parse ":40", "1:30", "1:05:30", or plain "90" into seconds
function parseTimeToSeconds(str) {
  if (!str) return null;
  const s = String(str).trim();

  if (s.startsWith(':')) {
    const sec = parseInt(s.slice(1), 10);
    return Number.isFinite(sec) ? sec : null;
  }
  if (s.includes(':')) {
    const parts = s.split(':').map(t => t.trim());
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const sec = parseInt(parts[1], 10);
      return (Number.isFinite(m) && Number.isFinite(sec)) ? (m * 60 + sec) : null;
    }
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const sec = parseInt(parts[2], 10);
      return (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(sec)) ? (h * 3600 + m * 60 + sec) : null;
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
  const atIdx = line.indexOf('@');
  if (atIdx === -1) return null;
  let after = line.slice(atIdx + 1).trim();
  after = after.split('/')[0].trim();           // if ":40/:45" -> take ":40"
  const token = after.split(/\s+/)[0];          // stop at first whitespace
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
      return Array(times).fill(block).join('\n');
    });
  }
  return out;
}

// Compute total seconds for a section (swim or break)
function computeSectionTimeSeconds(section) {
  if (section.type === 'break') {
    return parseTimeToSeconds(section.content) || 0;
  }
  if (!section.content) return 0;

  const expanded = expandBlocks(section.content);
  let total = 0;

  for (let raw of expanded.split('\n')) {
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
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
/* -------------------------------- */

function PracticeBuilder() {
  const [sections, setSections] = useState([
    {
      id: '1',
      name: 'Warm Up',
      type: 'swim',
      content: `400 Free @ 10:00
4 x 100 K/S/D/S @ 2:00
4 x 50 Build @ :50`,
    },
    { id: '2', name: 'Pre-Set', type: 'swim', content: '' },
    { id: '3', name: 'Break', type: 'break', content: '5:00' },
    { id: '4', name: 'Main Set', type: 'swim', content: '' },
    { id: '5', name: 'Cool Down', type: 'swim', content: '200 EZ @ 5:00' },
  ]);

  const [showPreview, setShowPreview] = useState(false);

  // ✅ Hooks must be inside the component
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

  const addSwimSection = () => {
    const newId = Date.now().toString();
    setSections([...sections, { id: newId, name: 'New Section', type: 'swim', content: '' }]);
  };

  const addBreakSection = () => {
    const newId = Date.now().toString();
    setSections([...sections, { id: newId, name: '', type: 'break', content: '' }]);
  };

  const deleteSection = (id) => {
    setSections(sections.filter((section) => section.id !== id));
  };

  const updateSection = (id, field, value) => {
    setSections(sections.map((section) => (section.id === id ? { ...section, [field]: value } : section)));
  };

  // Live yardage & time (per section + totals)
  const sectionYardages = useMemo(
    () => sections.map((s) => (s.type === 'swim' ? parseYardage(s.content) : 0)),
    [sections]
  );
  const sectionTimes = useMemo(() => sections.map((s) => computeSectionTimeSeconds(s)), [sections]);

  const totalYardage = sectionYardages.reduce((sum, v) => sum + v, 0);
  const totalTimeSec = sectionTimes.reduce((sum, v) => sum + v, 0);

  return (
    <div className="builder-page">
      <div className="app-container">
        <h1 className="header">Practice Builder</h1>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{
            // Hide the big “To pick up a draggable item…” text
            screenReaderInstructions: {
              draggable: '',   // empty = no visible instructions
            },
            // Also silence live announcements
            announcements: {
              onDragStart: () => '',
              onDragMove: () => '',
              onDragOver: () => '',
              onDragEnd: () => '',
              onDragCancel: () => '',
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

        <div className="add-buttons">
          <button className="add-btn" onClick={addSwimSection}>+ Add Section</button>
          <button className="add-btn light" onClick={addBreakSection}>+ Add Break</button>
        </div>

        <button className="preview-btn" onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>

        {showPreview && (
          <div className="preview-panel">
            {sections.map((section, index) =>
              section.type === 'break' ? (
                <div key={section.id} className="preview-break">
                  {section.name || 'Break'}{section.content ? ` @ ${section.content}` : ''}
                </div>
              ) : (
                <div key={section.id} className="preview-section">
                  <div className="preview-title-row">
                    <div className="preview-title-left">
                      {section.name}
                      {sectionYardages[index] > 0 ? ` – ${formatYardage(sectionYardages[index])}m` : ''}
                    </div>
                    <div className="preview-title-right">
                      {sectionTimes[index] > 0 ? `${formatSeconds(sectionTimes[index])}` : ''}
                    </div>
                  </div>

                  {section.content.split('\n').map((line, i) => (
                    <div key={i} className="preview-line">
                      {line.trim() === '' ? <br /> : line}
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
                <strong>{totalTimeSec > 0 ? formatSeconds(totalTimeSec) : ''}</strong>
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
      {section.type === 'break' ? (
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
            onChange={(e) => onChange(section.id, 'name', e.target.value)}
          />
          <input
            type="text"
            className="break-input"
            placeholder="e.g. 5:00"
            value={section.content}
            onChange={(e) => onChange(section.id, 'content', e.target.value)}
          />
          <button className="delete-btn" onClick={() => onDelete(section.id)}>❌</button>
        </div>
      ) : (
        <>
          <div className="section-header" {...attributes} {...listeners}>
            <button className="drag-handle" aria-label="Drag section" {...attributes} {...listeners}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <input
              type="text"
              className="section-name-input"
              value={section.name}
              onChange={(e) => onChange(section.id, 'name', e.target.value)}
            />
            {yardage > 0 && <span className="yardage-display">– {formatYardage(yardage)}m</span>}
            {timeSec > 0 && <span className="yardage-display"> @ {formatSeconds(timeSec)}</span>}
            <button className="delete-btn" onClick={() => onDelete(section.id)}>❌</button>
          </div>

          <textarea
            className="practice-input"
            placeholder="e.g. 3x100 Free @ 1:30"
            value={section.content}
            onChange={(e) => onChange(section.id, 'content', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.target;
                const { selectionStart, selectionEnd } = el;
                const updated =
                  section.content.slice(0, selectionStart) +
                  '\t' +
                  section.content.slice(selectionEnd);
                onChange(section.id, 'content', updated);
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
