// src/api/client.js

// Support Vite (import.meta.env) and CRA (process.env.REACT_APP_*)
const viteEnv = typeof import.meta !== "undefined" ? import.meta.env : {};
const API_BASE =
  (viteEnv && viteEnv.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:5174";

const ADMIN_KEY =
  (viteEnv && viteEnv.VITE_ADMIN_KEY) ||
  process.env.REACT_APP_ADMIN_KEY ||
  ""; // leave empty -> 401 if server requires it

console.log("API_BASE =", API_BASE);
console.log("ADMIN_KEY present =", !!ADMIN_KEY);


export function authHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-user-id": "kyle", // dev only
    ...(ADMIN_KEY ? { "x-admin-key": ADMIN_KEY } : {}),
    ...extra,
  };
}

async function handle(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

export async function get(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  return handle(res);
}
export async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handle(res);
}
export async function put(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handle(res);
}
export async function del(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handle(res);
}
