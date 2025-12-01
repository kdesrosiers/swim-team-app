import { get, post, put, del } from "./client";
import API_URL from "../config";

export async function exportPracticeDocx(payload) {
  const response = await fetch(`${API_URL}/api/export/docx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`,
      "x-admin-key": localStorage.getItem("adminKey") || "",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Export failed" }));
    throw new Error(error.error || "Export failed");
  }

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = "Practice.docx";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  // Get the blob and trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return { ok: true, filename };
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

