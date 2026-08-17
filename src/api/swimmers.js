// src/api/swimmers.js
import { get, post, put, del } from "./client";

// ========== ROSTER GROUPS ==========

export async function listRosterGroups() {
  return get("/api/roster-groups");
}

export async function createRosterGroup(data) {
  return post("/api/roster-groups", data);
}

export async function updateRosterGroup(id, updates) {
  return put(`/api/roster-groups/${id}`, updates);
}

export async function deleteRosterGroup(id) {
  return del(`/api/roster-groups/${id}`);
}

// ========== SWIMMERS ==========

/**
 * Fetch all swimmers. Optional filters: group (id), active (boolean), search (string).
 */
export async function listSwimmers(filters = {}) {
  const params = new URLSearchParams();
  if (filters.group)              params.append("group", filters.group);
  if (filters.active !== undefined) params.append("active", String(filters.active));
  if (filters.search)             params.append("search", filters.search);
  const qs = params.toString();
  return get(qs ? `/api/swimmers?${qs}` : "/api/swimmers");
}

export async function getSwimmer(id) {
  return get(`/api/swimmers/${id}`);
}

export async function createSwimmer(data) {
  return post("/api/swimmers", data);
}

/**
 * Update swimmer info / contact / notes. Does NOT touch bestTimes.
 */
export async function updateSwimmer(id, updates) {
  return put(`/api/swimmers/${id}`, updates);
}

export async function deleteSwimmer(id) {
  return del(`/api/swimmers/${id}`);
}

// ========== EMBEDDED BEST TIMES ==========

/**
 * Add a time entry. Returns the full updated swimmer document.
 * @param {string} swimmerId
 * @param {{ event, course, time, meetName?, date? }} data
 */
export async function addTime(swimmerId, data) {
  return post(`/api/swimmers/${swimmerId}/times`, data);
}

/**
 * Edit an embedded time entry. Returns the full updated swimmer document.
 */
export async function updateTime(swimmerId, timeId, updates) {
  return put(`/api/swimmers/${swimmerId}/times/${timeId}`, updates);
}

/**
 * Delete an embedded time entry. Returns the full updated swimmer document.
 */
export async function deleteTime(swimmerId, timeId) {
  return del(`/api/swimmers/${swimmerId}/times/${timeId}`);
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Calculate age from date of birth (works with both `dob` and legacy `dateOfBirth` fields).
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob   = new Date(dateOfBirth);
  const today = new Date();
  let age     = today.getFullYear() - dob.getFullYear();
  const md    = today.getMonth() - dob.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
