/**
 * Parse intervals from practice text and calculate timeSeconds
 * Handles formats like:
 * - "4x25 @ :50" → 4 × 50 sec = 200 sec
 * - "8x100 on 1:30" → 8 × 90 sec = 720 sec
 * - "200 Smooth @ 4:00" → 240 sec
 * - "2 x { 100 @ 2:00, 50 @ 1:00 }" → nested sets
 */

/**
 * Convert time string to seconds
 * @param {string} timeStr - Time in format like ":50", "1:30", "4:00", etc.
 * @returns {number} - Total seconds
 */
export function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;

  const cleaned = timeStr.trim().replace(/^@\s*/, '').replace(/^on\s*/, '');

  // Handle formats: ":50", "1:30", "4:00:00"
  const parts = cleaned.split(':').map(p => parseInt(p, 10) || 0);

  if (parts.length === 1) {
    // Just seconds
    return parts[0];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

/**
 * Extract first interval from a line
 * @param {string} line - Practice line text
 * @returns {number} - Interval time in seconds, or 0 if not found
 */
export function extractInterval(line) {
  if (!line) return 0;

  // Match patterns like "@ :50", "@ 1:30", "on 1:30", etc.
  const intervalMatch = line.match(/(?:@|on)\s*(\d*:?\d+(?::\d+)?)/i);

  if (intervalMatch && intervalMatch[1]) {
    return parseTimeToSeconds(intervalMatch[1]);
  }

  return 0;
}

/**
 * Parse reps from a line
 * @param {string} line - Practice line text
 * @returns {number} - Number of reps
 */
export function extractReps(line) {
  if (!line) return 1;

  // Match patterns like "4x25", "4 x 100", etc.
  const repsMatch = line.match(/^(\d+)\s*[xX×]\s*/);

  if (repsMatch && repsMatch[1]) {
    return parseInt(repsMatch[1], 10);
  }

  return 1;
}

/**
 * Extract yardage from a line
 * @param {string} line - Practice line text
 * @returns {number} - Yardage value
 */
export function extractYardage(line) {
  if (!line) return 0;

  // Match "4x100" or "4 x 100" or just "200"
  const repsMatch = line.match(/^(\d+)\s*[xX×]\s*(\d+)/);
  if (repsMatch) {
    const reps = parseInt(repsMatch[1], 10);
    const distance = parseInt(repsMatch[2], 10);
    return reps * distance;
  }

  // Just a single distance
  const distMatch = line.match(/^(\d+)\s+/);
  if (distMatch) {
    return parseInt(distMatch[1], 10);
  }

  return 0;
}

/**
 * Expand curly brace blocks like "2 x { 100 @ 2:00, 50 @ 1:00 }"
 * @param {string} text - Text with potential nested blocks
 * @returns {string} - Expanded text
 */
export function expandBlocks(text) {
  let out = text;
  const pattern = /(\d+)\s*[xX×]\s*{([^{}]*)}/gs;

  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  while (pattern.test(out) && iterations < maxIterations) {
    out = out.replace(pattern, (_, n, inner) => {
      const times = parseInt(n, 10);
      if (!Number.isFinite(times) || times <= 0) return inner;
      const block = inner.trim();
      return Array(times).fill(block).join("\n");
    });
    pattern.lastIndex = 0; // Reset regex
    iterations++;
  }

  return out;
}

/**
 * Calculate total time for a section of text
 * @param {string} text - Practice section content
 * @returns {number} - Total time in seconds
 */
export function calculateSectionTime(text) {
  if (!text || typeof text !== 'string') return 0;

  // First expand any curly brace blocks
  const expanded = expandBlocks(text);

  let totalSeconds = 0;
  const lines = expanded.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip lines that start with "break" (handled separately)
    if (/^break/i.test(trimmed)) continue;

    const reps = extractReps(trimmed);
    const interval = extractInterval(trimmed);

    if (interval > 0) {
      totalSeconds += reps * interval;
    } else {
      // No interval specified, estimate based on yardage
      const yardage = extractYardage(trimmed);
      if (yardage > 0) {
        // Rough estimate: 1:30 per 100 yards (90 sec / 100 yds)
        totalSeconds += Math.ceil((yardage / 100) * 90);
      }
    }
  }

  return totalSeconds;
}

/**
 * Calculate yardage for a section of text
 * @param {string} text - Practice section content
 * @returns {number} - Total yardage
 */
export function calculateSectionYardage(text) {
  if (!text || typeof text !== 'string') return 0;

  const expanded = expandBlocks(text);

  let totalYardage = 0;
  const lines = expanded.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^break/i.test(trimmed)) continue;

    totalYardage += extractYardage(trimmed);
  }

  return totalYardage;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 * @param {number} seconds - Total seconds
 * @param {boolean} forceHours - Always show hours even if 0
 * @returns {string} - Formatted time
 */
export function formatTimeSeconds(seconds, forceHours = false) {
  if (!seconds || seconds < 0) return forceHours ? "0:00:00" : "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0 || forceHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format clock time (seconds since midnight) to HH:MM:SS
 * @param {number} secondsSinceMidnight - Seconds since midnight
 * @param {boolean} use12Hour - Use 12-hour format with AM/PM
 * @returns {string} - Formatted clock time
 */
export function formatClockTime(secondsSinceMidnight, use12Hour = false) {
  if (!secondsSinceMidnight || secondsSinceMidnight < 0) return "";

  const hours24 = Math.floor(secondsSinceMidnight / 3600) % 24;
  const minutes = Math.floor((secondsSinceMidnight % 3600) / 60);
  const seconds = Math.floor(secondsSinceMidnight % 60);

  if (use12Hour) {
    const hours12 = hours24 % 12 || 12;
    const period = hours24 < 12 ? 'AM' : 'PM';
    return `${hours12}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${period}`;
  }

  return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse clock time string to seconds since midnight
 * @param {string} timeStr - Time string like "5:00 PM", "17:00:00", "5:30"
 * @returns {number} - Seconds since midnight
 */
export function parseClockTime(timeStr) {
  if (!timeStr) return 0;

  const cleaned = timeStr.trim();

  // Check for AM/PM
  const isPM = /PM/i.test(cleaned);
  const isAM = /AM/i.test(cleaned);

  // Remove AM/PM
  const timePart = cleaned.replace(/\s*(AM|PM)/i, '').trim();

  // Parse time parts
  const parts = timePart.split(':').map(p => parseInt(p, 10) || 0);

  let hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;

  // Handle 12-hour format
  if (isPM && hours !== 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return hours * 3600 + minutes * 60 + seconds;
}
