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

// ========== LOCATIONS ==========

export async function listLocations() {
  return get("/api/locations");
}

export async function createLocation(data) {
  return post("/api/locations", data);
}

export async function updateLocation(id, updates) {
  return put(`/api/locations/${id}`, updates);
}

export async function deleteLocation(id) {
  return del(`/api/locations/${id}`);
}

// ========== SWIMMERS ==========

/**
 * Fetch all swimmers with optional filters
 * @param {Object} filters - { rosterGroup?, location?, memberStatus?, search?, sortBy?, sortOrder? }
 * @returns {Promise<Array>} Array of swimmer objects
 */
export async function listSwimmers(filters = {}) {
  const params = new URLSearchParams();

  if (filters.rosterGroup) params.append("rosterGroup", filters.rosterGroup);
  if (filters.location) params.append("location", filters.location);
  if (filters.memberStatus) params.append("memberStatus", filters.memberStatus);
  if (filters.search) params.append("search", filters.search);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

  const queryString = params.toString();
  const url = queryString ? `/api/swimmers?${queryString}` : "/api/swimmers";

  return get(url);
}

/**
 * Fetch a single swimmer by ID
 * @param {string} id - The swimmer ID
 * @returns {Promise<Object>} Swimmer object
 */
export async function getSwimmer(id) {
  return get(`/api/swimmers/${id}`);
}

/**
 * Create a new swimmer
 * @param {Object} swimmer - Swimmer data
 * @returns {Promise<Object>} Created swimmer object
 */
export async function createSwimmer(swimmer) {
  return post("/api/swimmers", swimmer);
}

/**
 * Update an existing swimmer
 * @param {string} id - The swimmer ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated swimmer object
 */
export async function updateSwimmer(id, updates) {
  return put(`/api/swimmers/${id}`, updates);
}

/**
 * Delete a swimmer (soft delete)
 * @param {string} id - The swimmer ID
 * @returns {Promise<Object>} Response object
 */
export async function deleteSwimmer(id) {
  return del(`/api/swimmers/${id}`);
}

// ========== BEST TIMES ==========

/**
 * Get all best times for a swimmer
 * @param {string} swimmerId - The swimmer ID
 * @returns {Promise<Array>} Array of best time objects
 */
export async function listBestTimes(swimmerId) {
  return get(`/api/swimmers/${swimmerId}/best-times`);
}

/**
 * Create a new best time record
 * @param {string} swimmerId - The swimmer ID
 * @param {Object} data - Best time data
 * @returns {Promise<Object>} Created best time object
 */
export async function createBestTime(swimmerId, data) {
  return post(`/api/swimmers/${swimmerId}/best-times`, data);
}

/**
 * Update a best time record
 * @param {string} id - The best time ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated best time object
 */
export async function updateBestTime(id, updates) {
  return put(`/api/best-times/${id}`, updates);
}

/**
 * Delete a best time record
 * @param {string} id - The best time ID
 * @returns {Promise<Object>} Response object
 */
export async function deleteBestTime(id) {
  return del(`/api/best-times/${id}`);
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Calculate age from date of birth
 * @param {Date|string} dateOfBirth - The date of birth
 * @returns {number} Age in years
 */
export function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Generate USA Swimming ID helper
 * Format: LLLLLFMMDDYYYY (5 letters of last name + first initial + middle initial + DOB)
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} middleName
 * @param {Date|string} dateOfBirth
 * @returns {string} Suggested USA Swimming ID
 */
export function generateUSASwimmingId(firstName, lastName, middleName, dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const lastNamePart = lastName.substring(0, 5).toUpperCase().padEnd(5, "X");
  const firstInitial = firstName.charAt(0).toUpperCase();
  const middleInitial = middleName ? middleName.charAt(0).toUpperCase() : "X";

  const month = String(dob.getMonth() + 1).padStart(2, "0");
  const day = String(dob.getDate()).padStart(2, "0");
  const year = dob.getFullYear();

  return `${lastNamePart}${firstInitial}${middleInitial}${month}${day}${year}`;
}

/**
 * Format time in seconds to MM:SS.00 format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${minutes}:${secs.padStart(5, "0")}`;
}

/**
 * Parse time in MM:SS.00 format to seconds
 * @param {string} timeString - Time string (e.g., "1:23.45")
 * @returns {number} Time in seconds
 */
export function parseTime(timeString) {
  const [minutes, seconds] = timeString.split(":").map(Number);
  return minutes * 60 + seconds;
}
