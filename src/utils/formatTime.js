/**
 * Format raw seconds to swim time display string.
 * < 60s → "SS.ss"  (e.g. "59.43")
 * ≥ 60s → "M:SS.ss" (e.g. "1:03.21")
 */
export function formatTime(seconds) {
  if (seconds == null || seconds === '') return '–';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return m > 0 ? `${m}:${s}` : s;
}

/**
 * Parse a swim time string ("1:03.21" or "59.43") to raw seconds.
 * Returns null if unparseable.
 */
export function parseSwimTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes(':')) {
    const [m, sec] = s.split(':');
    const parsed = parseInt(m, 10) * 60 + parseFloat(sec);
    return isNaN(parsed) ? null : parsed;
  }
  const parsed = parseFloat(s);
  return isNaN(parsed) ? null : parsed;
}
