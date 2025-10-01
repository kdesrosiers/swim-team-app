/**
 * Shared time/formatting utilities for swim practice calculations
 */

/**
 * Parse time string to seconds
 * Accepts: ":40", "1:30", "1:05:30", or plain "90"
 * @param {string} str - Time string to parse
 * @returns {number|null} - Seconds or null if invalid
 */
export function parseTimeToSeconds(str) {
  if (!str) return null;
  const s = String(str).trim();

  // ":40" format -> 40 seconds
  if (s.startsWith(":")) {
    const sec = parseInt(s.slice(1), 10);
    return Number.isFinite(sec) ? sec : null;
  }

  // "1:30" or "1:05:30" format
  if (s.includes(":")) {
    const parts = s.split(":").map((t) => t.trim());

    // MM:SS
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const sec = parseInt(parts[1], 10);
      return Number.isFinite(m) && Number.isFinite(sec) ? m * 60 + sec : null;
    }

    // HH:MM:SS
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const sec = parseInt(parts[2], 10);
      return Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(sec)
        ? h * 3600 + m * 60 + sec
        : null;
    }
  }

  // Plain number "90" -> 90 seconds
  if (/^\d+$/.test(s)) {
    const sec = parseInt(s, 10);
    return Number.isFinite(sec) ? sec : null;
  }

  return null;
}

/**
 * Extract the first interval time from a line (e.g., "3x100 @ 1:30")
 * Handles multiple intervals like ":40/:45" by taking the first
 * @param {string} line - Line to parse
 * @returns {number|null} - Interval in seconds or null
 */
export function extractFirstIntervalSeconds(line) {
  const atIdx = line.indexOf("@");
  if (atIdx === -1) return null;

  let after = line.slice(atIdx + 1).trim();
  after = after.split("/")[0].trim(); // if ":40/:45" -> take ":40"
  const token = after.split(/\s+/)[0]; // stop at first whitespace

  return parseTimeToSeconds(token);
}

/**
 * Expand innermost "N x { ... }" blocks by repetition
 * @param {string} text - Text with nested blocks
 * @returns {string} - Expanded text
 */
export function expandBlocks(text) {
  let out = text;
  const pattern = /(\d+)\s*[xX]\s*{([^{}]*)}/s; // innermost only

  while (pattern.test(out)) {
    out = out.replace(pattern, (_, n, inner) => {
      const times = parseInt(n, 10);
      if (!Number.isFinite(times) || times <= 0) return inner;
      const block = inner.trim();
      return Array(times).fill(block).join("\n");
    });
  }

  return out;
}

/**
 * Compute total time in seconds for a section (swim or break)
 * @param {object} section - Section object with type and content
 * @returns {number} - Total seconds
 */
export function computeSectionTimeSeconds(section) {
  if (section.type === "break") {
    return parseTimeToSeconds(section.content) || 0;
  }

  if (!section.content) return 0;

  const expanded = expandBlocks(section.content);
  let total = 0;

  for (let raw of expanded.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^break/i.test(line)) continue;

    const perRep = extractFirstIntervalSeconds(line);
    if (perRep == null) continue;

    let reps = 1;
    const repsMatch = line.match(/^(\d+)\s*[xX]\b/);
    if (repsMatch) reps = parseInt(repsMatch[1], 10);

    total += reps * perRep;
  }

  return total;
}

/**
 * Format seconds as MM:SS or H:MM:SS
 * @param {number} totalSec - Total seconds
 * @returns {string} - Formatted time string
 */
export function formatSeconds(totalSec) {
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
export function ceilToMinute(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  return s % 60 === 0 ? s : Math.ceil(s / 60) * 60;
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
export function formatYardage(n) {
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "";
}
