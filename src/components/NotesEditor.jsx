import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { updatePractice } from "../api/practices";
import "./NotesEditor.css";

export default function NotesEditor({ practice, onUpdate }) {
  const [notes, setNotes] = useState(practice?.notes || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setNotes(practice?.notes || "");
    setHasChanges(false);
  }, [practice]);

  const handleNotesChange = (e) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    setHasChanges(newNotes !== (practice?.notes || ""));
  };

  const handleSave = async () => {
    if (!practice?._id) return;

    setIsSaving(true);
    try {
      const updated = await updatePractice(practice._id, { notes });
      setHasChanges(false);
      setIsEditing(false);
      toast.success("Notes saved successfully!");

      // Call onUpdate callback to refresh the practice in parent component
      if (onUpdate) {
        onUpdate({ ...practice, notes });
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error(error.message || "Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(practice?.notes || "");
    setIsEditing(false);
    setHasChanges(false);
  };

  return (
    <div className="notes-editor">
      <div className="notes-header">
        <h3 className="notes-title">Post-Practice Notes</h3>
        {!isEditing && (
          <button
            className="notes-edit-btn"
            onClick={() => setIsEditing(true)}
            title="Edit notes"
          >
            ✏️ Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="notes-edit-mode">
          <textarea
            className="notes-textarea"
            value={notes}
            onChange={handleNotesChange}
            placeholder="Add your post-practice notes here... (max 5000 characters)"
            maxLength={5000}
          />
          <div className="notes-footer">
            <span className="notes-char-count">
              {notes.length} / 5000
            </span>
            <div className="notes-actions">
              <button
                className="notes-cancel-btn"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="notes-save-btn"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="notes-display">
          {notes ? (
            <div className="notes-content">
              {notes.split("\n").map((line, idx) => (
                <div key={idx} className="notes-line">
                  {line || <br />}
                </div>
              ))}
            </div>
          ) : (
            <div className="notes-empty">
              No notes yet. Click Edit to add post-practice notes.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
