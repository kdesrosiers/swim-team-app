import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { listBestTimes, calculateAge } from "../api/swimmers";
import BestTimesManager from "./BestTimesManager";
import "./SwimmerDetailView.css";

function SwimmerDetailView({ swimmer, onEdit, onDelete, onClose, onUpdate }) {
  const [bestTimes, setBestTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBestTimesManager, setShowBestTimesManager] = useState(false);

  const loadBestTimes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listBestTimes(swimmer._id);
      setBestTimes(data);
    } catch (e) {
      console.error("Failed to load best times:", e);
      toast.error("Failed to load best times");
    } finally {
      setLoading(false);
    }
  }, [swimmer._id]);

  useEffect(() => {
    loadBestTimes();
  }, [loadBestTimes]);

  const handleBestTimesSuccess = () => {
    loadBestTimes();
    setShowBestTimesManager(false);
  };

  const age = calculateAge(swimmer.dateOfBirth);

  // Group best times by stroke
  const bestTimesByStroke = {};
  bestTimes.forEach((bt) => {
    if (!bestTimesByStroke[bt.stroke]) {
      bestTimesByStroke[bt.stroke] = [];
    }
    bestTimesByStroke[bt.stroke].push(bt);
  });

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-title-row">
          <div className="detail-avatar">
            {swimmer.firstName.charAt(0)}
            {swimmer.lastName.charAt(0)}
          </div>
          <div className="detail-title-info">
            <h2>{swimmer.preferredName || `${swimmer.firstName} ${swimmer.lastName}`}</h2>
            <p className="detail-subtitle">
              {age} years old • {swimmer.rosterGroup?.name}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="detail-actions">
          <button className="btn-action btn-edit" onClick={() => onEdit(swimmer)}>
            ✏️ Edit
          </button>
          <button
            className="btn-action btn-delete"
            onClick={() => onDelete(swimmer._id, `${swimmer.firstName} ${swimmer.lastName}`)}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      <div className="detail-content">
        {/* Basic Information */}
        <div className="detail-section">
          <h3>Basic Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Legal Name</span>
              <span className="info-value">
                {swimmer.firstName} {swimmer.middleName ? `${swimmer.middleName} ` : ""}{swimmer.lastName}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Date of Birth</span>
              <span className="info-value">
                {new Date(swimmer.dateOfBirth).toLocaleDateString()}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Gender</span>
              <span className="info-value">{swimmer.gender}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className={`status-badge status-${swimmer.memberStatus.toLowerCase()}`}>
                {swimmer.memberStatus}
              </span>
            </div>
            {swimmer.joinDate && (
              <div className="info-item">
                <span className="info-label">Member Since</span>
                <span className="info-value">
                  {new Date(swimmer.joinDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Identification */}
        <div className="detail-section">
          <h3>Identification</h3>
          <div className="info-grid">
            {swimmer.usaSwimmingId && (
              <div className="info-item">
                <span className="info-label">USA Swimming ID</span>
                <span className="info-value">{swimmer.usaSwimmingId}</span>
              </div>
            )}
            {swimmer.customSwimmerId && (
              <div className="info-item">
                <span className="info-label">Custom ID</span>
                <span className="info-value">{swimmer.customSwimmerId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Organization */}
        <div className="detail-section">
          <h3>Organization</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Roster Group</span>
              <span className="info-value">{swimmer.rosterGroup?.name || "—"}</span>
            </div>
            {swimmer.location && (
              <div className="info-item">
                <span className="info-label">Location</span>
                <span className="info-value">{swimmer.location.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        {(swimmer.email || swimmer.phone || swimmer.emergencyContact?.name) && (
          <div className="detail-section">
            <h3>Contact Information</h3>
            <div className="info-grid">
              {swimmer.email && (
                <div className="info-item">
                  <span className="info-label">Email</span>
                  <span className="info-value">{swimmer.email}</span>
                </div>
              )}
              {swimmer.phone && (
                <div className="info-item">
                  <span className="info-label">Phone</span>
                  <span className="info-value">{swimmer.phone}</span>
                </div>
              )}
              {swimmer.emergencyContact?.name && (
                <div className="info-item">
                  <span className="info-label">Emergency Contact</span>
                  <span className="info-value">
                    {swimmer.emergencyContact.name}
                    {swimmer.emergencyContact.relationship && ` (${swimmer.emergencyContact.relationship})`}
                  </span>
                </div>
              )}
              {swimmer.emergencyContact?.phone && (
                <div className="info-item">
                  <span className="info-label">Emergency Phone</span>
                  <span className="info-value">{swimmer.emergencyContact.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical & Safety */}
        {(swimmer.medicalNotes || swimmer.insurance?.provider || swimmer.racingStartCertified) && (
          <div className="detail-section">
            <h3>Medical & Safety</h3>
            <div className="info-grid">
              {swimmer.medicalNotes && (
                <div className="info-item full-width">
                  <span className="info-label">Medical Notes</span>
                  <span className="info-value">{swimmer.medicalNotes}</span>
                </div>
              )}
              {swimmer.insurance?.provider && (
                <div className="info-item">
                  <span className="info-label">Insurance Provider</span>
                  <span className="info-value">{swimmer.insurance.provider}</span>
                </div>
              )}
              {swimmer.insurance?.policyNumber && (
                <div className="info-item">
                  <span className="info-label">Policy Number</span>
                  <span className="info-value">{swimmer.insurance.policyNumber}</span>
                </div>
              )}
              {swimmer.racingStartCertified && (
                <div className="info-item">
                  <span className="info-label">Racing Start Certified</span>
                  <span className="info-value">✓ Yes</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Best Times */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Best Times</h3>
            <button
              className="btn-add-times"
              onClick={() => setShowBestTimesManager(true)}
            >
              ➕ Add Time
            </button>
          </div>

          {loading ? (
            <p className="loading-message">Loading best times...</p>
          ) : bestTimes.length === 0 ? (
            <p className="empty-message">No best times recorded yet.</p>
          ) : (
            <div className="best-times-container">
              {Object.entries(bestTimesByStroke).map(([stroke, times]) => (
                <div key={stroke} className="stroke-group">
                  <h4>{stroke}</h4>
                  <div className="times-grid">
                    {times
                      .sort((a, b) => a.distance - b.distance)
                      .map((time) => (
                        <div key={time._id} className="time-card">
                          <div className="time-info">
                            <div className="time-distance">
                              {time.distance}m {time.course}
                            </div>
                            <div className="time-value">{time.timeFormatted}</div>
                            <div className="time-meta">
                              {time.meetName && <span>{time.meetName}</span>}
                              <span>{new Date(time.meetDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Swimming Profile */}
        {(swimmer.swimsuitSize || swimmer.notes) && (
          <div className="detail-section">
            <h3>Swimming Profile</h3>
            <div className="info-grid">
              {swimmer.swimsuitSize && (
                <div className="info-item">
                  <span className="info-label">Swimsuit Size</span>
                  <span className="info-value">{swimmer.swimsuitSize}</span>
                </div>
              )}
              {swimmer.notes && (
                <div className="info-item full-width">
                  <span className="info-label">Coach Notes</span>
                  <span className="info-value">{swimmer.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Best Times Manager Modal */}
      {showBestTimesManager && (
        <BestTimesManager
          swimmer={swimmer}
          bestTimes={bestTimes}
          onClose={() => setShowBestTimesManager(false)}
          onSuccess={handleBestTimesSuccess}
        />
      )}
    </div>
  );
}

export default SwimmerDetailView;
