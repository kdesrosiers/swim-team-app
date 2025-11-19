import React, { useState } from "react";
import toast from "react-hot-toast";
import { createBestTime, deleteBestTime, parseTime, formatTime } from "../api/swimmers";
import "./BestTimesManager.css";

function BestTimesManager({ swimmer, bestTimes, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    stroke: "Freestyle",
    distance: 100,
    course: "SCY",
    time: "",
    timeFormatted: "",
    meetName: "",
    meetDate: new Date().toISOString().split("T")[0],
    timeStandard: "",
  });

  const [saving, setSaving] = useState(false);
  const [timeMode, setTimeMode] = useState("decimal"); // "decimal" or "formatted"

  const strokes = ["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"];
  const courses = ["SCY", "SCM", "LCM"];
  const distances = {
    Freestyle: [50, 100, 200, 500, 1000],
    Backstroke: [50, 100, 200],
    Breaststroke: [50, 100, 200],
    Butterfly: [50, 100, 200],
    IM: [100, 200, 400],
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTimeChange = (e) => {
    const { value } = e.target;

    if (timeMode === "decimal") {
      setFormData((prev) => ({
        ...prev,
        time: value,
        timeFormatted: value ? formatTime(parseFloat(value)) : "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        timeFormatted: value,
        time: value ? String(parseTime(value)) : "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.time || (timeMode === "formatted" && !formData.timeFormatted)) {
      toast.error("Please enter a time");
      return;
    }

    if (!formData.meetDate) {
      toast.error("Please select a meet date");
      return;
    }

    try {
      setSaving(true);

      const data = {
        event: `${formData.distance}m ${formData.stroke}`,
        stroke: formData.stroke,
        distance: parseInt(formData.distance, 10),
        course: formData.course,
        time: parseFloat(formData.time),
        meetName: formData.meetName || undefined,
        meetDate: formData.meetDate,
        timeStandard: formData.timeStandard || undefined,
      };

      await createBestTime(swimmer._id, data);
      toast.success("Best time added successfully!");

      // Reset form
      setFormData({
        stroke: "Freestyle",
        distance: 100,
        course: "SCY",
        time: "",
        timeFormatted: "",
        meetName: "",
        meetDate: new Date().toISOString().split("T")[0],
        timeStandard: "",
      });

      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to add best time");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTime = async (timeId) => {
    if (!window.confirm("Delete this best time?")) {
      return;
    }

    try {
      await deleteBestTime(timeId);
      toast.success("Best time deleted!");
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to delete best time");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content best-times-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Best Times for {swimmer.firstName} {swimmer.lastName}</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="best-times-form-section">
            <h3>Add New Best Time</h3>
            <form onSubmit={handleSubmit} className="best-times-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stroke">Stroke</label>
                  <select
                    id="stroke"
                    name="stroke"
                    value={formData.stroke}
                    onChange={handleInputChange}
                  >
                    {strokes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="distance">Distance</label>
                  <select
                    id="distance"
                    name="distance"
                    value={formData.distance}
                    onChange={handleInputChange}
                  >
                    {distances[formData.stroke].map((d) => (
                      <option key={d} value={d}>
                        {d}m
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="course">Course</label>
                  <select
                    id="course"
                    name="course"
                    value={formData.course}
                    onChange={handleInputChange}
                  >
                    {courses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Time Entry</label>
                <div className="time-input-group">
                  <div className="mode-tabs">
                    <button
                      type="button"
                      className={`mode-tab ${timeMode === "decimal" ? "active" : ""}`}
                      onClick={() => setTimeMode("decimal")}
                    >
                      Decimal (60.5)
                    </button>
                    <button
                      type="button"
                      className={`mode-tab ${timeMode === "formatted" ? "active" : ""}`}
                      onClick={() => setTimeMode("formatted")}
                    >
                      Formatted (1:00.50)
                    </button>
                  </div>

                  {timeMode === "decimal" ? (
                    <input
                      type="number"
                      step="0.01"
                      value={formData.time}
                      onChange={handleTimeChange}
                      placeholder="Seconds (e.g., 60.5)"
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData.timeFormatted}
                      onChange={handleTimeChange}
                      placeholder="MM:SS.00 (e.g., 1:00.50)"
                      pattern="\d+:\d{2}\.\d{2}"
                      required
                    />
                  )}

                  {formData.time && (
                    <p className="time-display">
                      {formatTime(parseFloat(formData.time))}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="meetName">Meet Name</label>
                  <input
                    type="text"
                    id="meetName"
                    name="meetName"
                    value={formData.meetName}
                    onChange={handleInputChange}
                    placeholder="e.g. State Championships"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="meetDate">Meet Date</label>
                  <input
                    type="date"
                    id="meetDate"
                    name="meetDate"
                    value={formData.meetDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="timeStandard">Time Standard</label>
                <input
                  type="text"
                  id="timeStandard"
                  name="timeStandard"
                  value={formData.timeStandard}
                  onChange={handleInputChange}
                  placeholder="e.g. A, AA, AAA"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? "Adding..." : "Add Best Time"}
                </button>
              </div>
            </form>
          </div>

          {bestTimes.length > 0 && (
            <div className="best-times-list-section">
              <h3>Current Best Times</h3>
              <div className="best-times-list">
                {bestTimes.map((time) => (
                  <div key={time._id} className="best-time-item">
                    <div className="time-details">
                      <div className="time-event">
                        {time.distance}m {time.stroke} - {time.course}
                      </div>
                      <div className="time-value">{time.timeFormatted}</div>
                      <div className="time-date">
                        {time.meetName && <span>{time.meetName} • </span>}
                        {new Date(time.meetDate).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteTime(time._id)}
                      title="Delete best time"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BestTimesManager;
