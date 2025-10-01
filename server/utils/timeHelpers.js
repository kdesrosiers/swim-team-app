/**
 * Shared time/formatting utilities for server-side exports
 * (mirrors src/utils/timeHelpers.js but for Node.js)
 */

/**
 * Format seconds as MM:SS or H:MM:SS
 * @param {number} totalSec - Total seconds
 * @returns {string} - Formatted time string
 */
export function formatSeconds(totalSec = 0) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Round seconds up to the next minute
 * @param {number} sec - Seconds
 * @returns {number} - Rounded seconds
 */
export function ceilToMinute(sec) {
  return Math.ceil((sec || 0) / 60) * 60;
}

/**
 * Parse "HH:MM" or "HH:MM:SS" to seconds from midnight
 * @param {string} hhmm - Time string like "06:00" or "18:30:15"
 * @returns {number} - Seconds from midnight
 */
export function secondsFromHHMM(hhmm = "06:00") {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hhmm).trim());
  if (!m) return 0;

  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const s = m[3] ? Math.min(59, Math.max(0, parseInt(m[3], 10))) : 0;

  return h * 3600 + min * 60 + s;
}

/**
 * Format seconds from midnight as 12-hour clock (e.g., "6:30 AM")
 * @param {number} totalSecFromMidnight - Seconds from midnight
 * @param {boolean} showSeconds - Whether to show seconds
 * @returns {string} - Formatted clock time
 */
export function formatClock12(totalSecFromMidnight, showSeconds = false) {
  let s = ((totalSecFromMidnight % 86400) + 86400) % 86400; // wrap within 24h
  const h24 = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1; // 0→12, 13→1, etc.
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");

  return showSeconds ? `${h12}:${mm}:${ss} ${ampm}` : `${h12}:${mm} ${ampm}`;
}

/**
 * Format number with commas (e.g., 1000 -> "1,000")
 * @param {number} n - Number to format
 * @returns {string} - Formatted number string
 */
export function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-US");
}
