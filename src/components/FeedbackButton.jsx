import React, { useState } from "react";
import toast from "react-hot-toast";
import { submitFeedback } from "../api/feedback";
import "./FeedbackButton.css";

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!feedback.trim()) {
      toast.error("Please enter your feedback");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback(feedback, window.location.pathname);
      toast.success("Thank you for your feedback!");
      setFeedback("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error(error.message || "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFeedback("");
    setIsOpen(false);
  };

  return (
    <>
      {/* Feedback Button */}
      <button
        className="feedback-button"
        onClick={() => setIsOpen(true)}
        title="Send feedback"
      >
        💬
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="feedback-overlay" onClick={handleClose}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-header">
              <h2 className="feedback-title">Send Feedback</h2>
              <button
                className="feedback-close-btn"
                onClick={handleClose}
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="feedback-form">
              <div className="feedback-field">
                <label htmlFor="feedback-textarea">Your Feedback</label>
                <textarea
                  id="feedback-textarea"
                  className="feedback-textarea"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your thoughts, suggestions, or report issues..."
                  maxLength={5000}
                  rows={6}
                  disabled={isSubmitting}
                />
                <div className="feedback-char-count">
                  {feedback.length} / 5000
                </div>
              </div>

              <div className="feedback-actions">
                <button
                  type="button"
                  className="feedback-cancel-btn"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="feedback-submit-btn"
                  disabled={isSubmitting || !feedback.trim()}
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
