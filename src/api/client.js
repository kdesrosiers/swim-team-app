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

const DEV_USER_ID =
  (viteEnv && viteEnv.VITE_DEV_USER_ID) ||
  process.env.REACT_APP_DEV_USER_ID ||
  ""; // empty = server will use its default

console.log("API_BASE =", API_BASE);
console.log("ADMIN_KEY present =", !!ADMIN_KEY);
console.log("DEV_USER_ID =", DEV_USER_ID || "(using server default)");


export function authHeaders(extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(DEV_USER_ID ? { "x-user-id": DEV_USER_ID } : {}),
    ...(ADMIN_KEY ? { "x-admin-key": ADMIN_KEY } : {}),
    ...extra,
  };

  // Add JWT token if available
  const token = localStorage.getItem("token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
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
