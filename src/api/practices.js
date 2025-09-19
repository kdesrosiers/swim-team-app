import { get, post, put, del } from "./client";

export function exportPracticeDocx(payload) {
  return post("/api/export/docx", payload);
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


