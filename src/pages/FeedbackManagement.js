import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listFeedback, updateFeedback } from "../api/feedback";
import "./FeedbackManagement.css";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "#3b82f6" },
  { value: "in-progress", label: "In Progress", color: "#f59e0b" },
  { value: "resolved", label: "Resolved", color: "#10b981" },
  { value: "dismissed", label: "Dismissed", color: "#6b7280" },
];

export default function FeedbackManagement() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Check if user is admin
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.isAdmin || false);
      } catch (e) {
        console.error("Failed to parse user data:", e);
        setIsAdmin(false);
      }
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadFeedback();
    }
  }, [filterStatus, page, isAdmin]);

  async function loadFeedback() {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filterStatus !== "all") {
        params.status = filterStatus;
      }
      const res = await listFeedback(params);
      setFeedbacks(res.items || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error("Error loading feedback:", error);
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      const feedback = feedbacks.find(f => f._id === id);
      await updateFeedback(id, {
        status: newStatus,
        notes: feedback.notes || "",
      });
      toast.success("Status updated");
      loadFeedback();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  }

  async function handleSaveNotes(id) {
    try {
      const feedback = feedbacks.find(f => f._id === id);
      await updateFeedback(id, {
        status: feedback.status,
        notes: editNotes,
      });
      toast.success("Notes saved");
      setEditingId(null);
      loadFeedback();
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    }
  }

  function handleExpandFeedback(id, notes) {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(id);
      setEditNotes(notes || "");
    }
  }

  const getStatusColor = (status) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option?.color || "#6b7280";
  };

  const getStatusLabel = (status) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option?.label || status;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isAdmin) {
    return (
      <div className="feedback-management-page">
        <div className="feedback-header">
          <h1 className="feedback-page-title">Access Denied</h1>
        </div>
        <div className="feedback-access-denied">
          <p>You do not have permission to access Feedback Management.</p>
          <p>Only administrators can view and manage feedback.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-management-page">
      <div className="feedback-header">
        <h1 className="feedback-page-title">Feedback Management</h1>
        <p className="feedback-page-subtitle">Review and manage user feedback</p>
      </div>

      {/* Filters */}
      <div className="feedback-filters">
        <div className="feedback-filter-group">
          <label>Filter by Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="feedback-status-filter"
          >
            <option value="all">All Feedbacks</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="feedback-summary">
          <span className="feedback-count">Total: {total} feedbacks</span>
        </div>
      </div>

      {/* Feedback List */}
      <div className="feedback-list">
        {loading && <div className="feedback-loading">Loading...</div>}

        {!loading && feedbacks.length === 0 && (
          <div className="feedback-empty">
            <p>No feedbacks found</p>
          </div>
        )}

        {!loading && feedbacks.map((feedback) => (
          <div
            key={feedback._id}
            className="feedback-item"
            style={{
              borderLeftColor: getStatusColor(feedback.status),
            }}
          >
            {/* Header */}
            <div className="feedback-item-header">
              <div className="feedback-item-left">
                <h3 className="feedback-item-title">
                  Feedback from {feedback.userId || "Anonymous"}
                </h3>
                <p className="feedback-item-meta">
                  <span>{formatDate(feedback.createdAt)}</span>
                  <span>•</span>
                  <span>{feedback.page}</span>
                </p>
              </div>

              <div className="feedback-item-right">
                <select
                  value={feedback.status}
                  onChange={(e) => handleStatusChange(feedback._id, e.target.value)}
                  className="feedback-status-select"
                  style={{
                    borderColor: getStatusColor(feedback.status),
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  className="feedback-expand-btn"
                  onClick={() => handleExpandFeedback(feedback._id, feedback.notes)}
                  title={expandedId === feedback._id ? "Collapse" : "Expand"}
                >
                  {expandedId === feedback._id ? "▼" : "▶"}
                </button>
              </div>
            </div>

            {/* Message */}
            <div className="feedback-item-message">
              {feedback.message}
            </div>

            {/* Expanded Section */}
            {expandedId === feedback._id && (
              <div className="feedback-item-expanded">
                <div className="feedback-notes-section">
                  <label className="feedback-notes-label">Status Notes</label>
                  {editingId === feedback._id ? (
                    <div className="feedback-notes-edit">
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add notes about the status of this feedback..."
                        maxLength={1000}
                        rows={4}
                        className="feedback-notes-textarea"
                      />
                      <div className="feedback-notes-footer">
                        <span className="feedback-notes-char-count">
                          {editNotes.length} / 1000
                        </span>
                        <div className="feedback-notes-actions">
                          <button
                            className="feedback-notes-cancel"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="feedback-notes-save"
                            onClick={() => handleSaveNotes(feedback._id)}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="feedback-notes-display">
                      {feedback.notes ? (
                        <p>{feedback.notes}</p>
                      ) : (
                        <p className="feedback-notes-empty">No notes yet</p>
                      )}
                      <button
                        className="feedback-notes-edit-btn"
                        onClick={() => {
                          setEditingId(feedback._id);
                          setEditNotes(feedback.notes || "");
                        }}
                      >
                        ✎ Edit Notes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="feedback-pagination">
          <button
            className="feedback-pagination-btn"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
            ← Previous
          </button>
          <div className="feedback-pagination-info">
            <span>Page {page} of {Math.ceil(total / 10)}</span>
          </div>
          <button
            className="feedback-pagination-btn"
            onClick={() => setPage(page + 1)}
            disabled={page * 10 >= total}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
