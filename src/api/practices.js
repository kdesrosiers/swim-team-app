import { get, post, put, del } from "./client";

export function exportPracticeDocx(payload) {
  // Add userId to the payload if available
  const userStr = localStorage.getItem("user");
  let userId = null;

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      userId = user._id;
    } catch (e) {
      console.error("Could not parse user from localStorage:", e);
    }
  }

  const payloadWithUserId = {
    ...payload,
    userId,
  };

  return post("/api/export/docx", payloadWithUserId);
}

export function listPractices(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return get(`/api/practices${qs ? `?${qs}` : ""}`);
}
export function getPractice(id) {
  return get(`/api/practices/${id}`);
}

export function createPractice(practice) {
  return post("/api/practices", practice);
}

export function updatePractice(id, patch) {
  return put(`/api/practices/${id}`, patch);
}

export function deletePractice(id) {
  return del(`/api/practices/${id}`);
}

export function toggleFavorite(id) {
  return put(`/api/practices/${id}/favorite`, {});
}

