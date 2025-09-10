import { get, post, put, del } from "./client";

export function exportPracticeDocx(payload) {
  return post("/api/export/docx", payload);
}

export function listPractices(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return get(`/api/practices${qs}`);
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


