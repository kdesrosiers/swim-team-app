import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatTimeSeconds } from '../utils/intervalParser';
import './GroupSplitSection.css';

export default function GroupSplitSection({
  section,
  index,
  onUpdate,
  onDelete,
  onAddGroupSection,
  onDeleteGroupSection,
  onUpdateGroupSection
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingGroupName, setEditingGroupName] = useState(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleAddGroup = () => {
    const groupName = prompt('Enter group name (e.g., Bronze, Silver, Gold):');
    if (!groupName) return;

    const newGroup = {
      id: `group-${Date.now()}`,
      name: groupName.trim(),
      sections: [],
      totalYardage: 0,
      totalTimeSeconds: 0,
      clockTime: ''
    };

    // Deep clone existing groups before adding new one
    const updatedGroups = [
      ...(section.groups || []).map(g => ({
        ...g,
        sections: (g.sections || []).map(s => ({ ...s }))
      })),
      newGroup
    ];
    onUpdate(section.id, 'groups', updatedGroups);
  };

  const handleDeleteGroup = (groupId) => {
    if (!window.confirm('Delete this group?')) return;

    // Deep clone remaining groups after filter
    const updatedGroups = (section.groups || [])
      .filter(g => g.id !== groupId)
      .map(g => ({
        ...g,
        sections: (g.sections || []).map(s => ({ ...s }))
      }));
    onUpdate(section.id, 'groups', updatedGroups);
  };

  const handleRenameGroup = (groupId, newName) => {
    const updatedGroups = (section.groups || []).map(g =>
      g.id === groupId
        ? { ...g, name: newName, sections: (g.sections || []).map(s => ({ ...s })) }
        : { ...g, sections: (g.sections || []).map(s => ({ ...s })) }
    );
    onUpdate(section.id, 'groups', updatedGroups);
    setEditingGroupName(null);
  };

  const handleAddSectionToGroup = (groupId) => {
    const newSection = {
      id: `section-${Date.now()}`,
      type: 'swim',
      title: 'New Section',
      text: '',
      yardage: 0,
      timeSeconds: 0
    };

    onAddGroupSection(section.id, groupId, newSection);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group-split-container"
    >
      <div className="group-split-header">
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>

        <input
          type="text"
          value={section.title}
          onChange={(e) => onUpdate(section.id, 'title', e.target.value)}
          className="section-title-input"
          placeholder="Section Title (e.g., Pre-Set)"
        />

        <button
          className="expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'}
        </button>

        {section.divergenceSeconds > 0 && (
          <span className="divergence-badge">
            Δ {formatTimeSeconds(section.divergenceSeconds)}
          </span>
        )}

        <button
          className="delete-btn"
          onClick={() => onDelete(section.id)}
        >
          ✕
        </button>
      </div>

      {isExpanded && (
        <div className="group-split-content">
          <div className="groups-grid">
            {(section.groups || []).map(group => (
              <div key={group.id} className="group-column">
                <div className="group-header">
                  {editingGroupName === group.id ? (
                    <input
                      type="text"
                      defaultValue={group.name}
                      autoFocus
                      onBlur={(e) => handleRenameGroup(group.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameGroup(group.id, e.target.value);
                        }
                      }}
                      className="group-name-input"
                    />
                  ) : (
                    <>
                      <h4
                        className="group-name"
                        onDoubleClick={() => setEditingGroupName(group.id)}
                      >
                        {group.name}
                      </h4>
                      {section.pacingGroup === group.name && (
                        <span className="pacing-badge" title="Longest duration">
                          🏃
                        </span>
                      )}
                    </>
                  )}
                  <button
                    className="delete-group-btn"
                    onClick={() => handleDeleteGroup(group.id)}
                    title="Delete group"
                  >
                    ✕
                  </button>
                </div>

                <div className="group-sections">
                  {(group.sections || []).map((groupSection, idx) => (
                    <div key={groupSection.id || idx} className="group-section-item">
                      <textarea
                        value={groupSection.text}
                        onChange={(e) => onUpdateGroupSection(section.id, group.id, groupSection.id, 'text', e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Tab") {
                            e.preventDefault();
                            const el = e.target;
                            const { selectionStart, selectionEnd } = el;
                            const updated =
                              groupSection.text.slice(0, selectionStart) +
                              "\t" +
                              groupSection.text.slice(selectionEnd);
                            onUpdateGroupSection(section.id, group.id, groupSection.id, 'text', updated);
                            setTimeout(() => {
                              el.selectionStart = el.selectionEnd = selectionStart + 1;
                            }, 0);
                          }
                        }}
                        placeholder="Enter practice text (e.g., 4x25 @ :50)"
                        className="group-section-textarea"
                        rows={3}
                      />
                      <button
                        className="delete-section-btn"
                        onClick={() => onDeleteGroupSection(section.id, group.id, groupSection.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    className="add-section-btn"
                    onClick={() => handleAddSectionToGroup(group.id)}
                  >
                    + Add Section
                  </button>
                </div>

                <div className="group-totals">
                  <div className="group-total-item">
                    <span className="label">Yardage:</span>
                    <span className="value">{group.totalYardage || 0}m</span>
                  </div>
                  <div className="group-total-item">
                    <span className="label">Duration:</span>
                    <span className="value">{formatTimeSeconds(group.totalTimeSeconds || 0)}</span>
                  </div>
                  {group.clockTime && (
                    <div className="group-total-item">
                      <span className="label">Clock:</span>
                      <span className="value">{group.clockTime}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="add-group-btn" onClick={handleAddGroup}>
            + Add Group
          </button>
        </div>
      )}
    </div>
  );
}
