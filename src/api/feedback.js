import { post, get, put } from "./client";

export function submitFeedback(message, page) {
  return post("/api/feedback", {
    message,
    page,
  });
}

export function listFeedback(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return get(`/api/feedback${qs ? `?${qs}` : ""}`);
}

export function getFeedback(id) {
  return get(`/api/feedback/${id}`);
}

export function updateFeedback(id, { status, notes }) {
  return put(`/api/feedback/${id}`, {
    status,
    notes,
  });
}
