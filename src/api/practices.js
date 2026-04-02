import { get, post, put, del, authHeaders } from "./client";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export async function exportPracticeDocx(payload, fallbackFilename = "practice-export.docx") {
  const res = await fetch(`${API_BASE}/api/export/docx`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Export failed: ${res.status} ${text}`.trim());
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : fallbackFilename;

  return { blob, filename };
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

