// src/api/PracticeBuilder.js

import { createPractice, listPractices } from "./practices";

/**
 * Map builder UI sections -> API shape
 * Expects:
 *   sections: [{ id, name, type: 'swim'|'break', content }]
 *   sectionYardages: number[]   // same order as sections
 *   sectionTimes: number[]      // same order as sections
 */
export function mapSectionsForApi(sections = [], sectionYardages = [], sectionTimes = []) {
  return sections.map((s, i) => ({
    // For swim sections, use the section name as both type/title.
    // For breaks, type becomes "Break" and title is "Break" (or name if provided).
    type: s.type === "break" ? "Break" : (s.name || "Section"),
    title: s.type === "break" ? (s.name || "Break") : (s.name || "Section"),
    text: s.content || "",
    yardage: Number.isFinite(sectionYardages[i]) ? sectionYardages[i] : 0,
    timeSeconds: Number.isFinite(sectionTimes[i]) ? sectionTimes[i] : 0,
  }));
}

/**
 * Save a practice from the builder state.
 * Call this from your PracticeBuilder page:
 *   await handleSavePractice({
 *     practiceTitle, practiceDate, pool, selectedRoster,
 *     sections, sectionYardages, sectionTimes,
 *     totalYardage, totalTimeSec,
 *   })
 */
export async function handleSavePractice({
  practiceTitle,
  practiceDate,           // "YYYY-MM-DD"
  pool = "SCM",           // "SCM" | "SCY" | "LCM"
  selectedRoster = "",
  season = null,          // Season title (optional)
  sections = [],
  sectionYardages = [],
  sectionTimes = [],
  totalYardage = 0,
  totalTimeSec = 0,
  stats = null,           // Stats object { strokes: {}, styles: {} }
  userId = "kyle",        // optional; your server also defaults this
}) {
  const title = practiceTitle?.trim() || `Practice ${practiceDate || ""}`.trim();

  const sectionsForApi = mapSectionsForApi(sections, sectionYardages, sectionTimes);

  const totals = {
    yardage: Number.isFinite(totalYardage) ? totalYardage : 0,
    timeSeconds: Number.isFinite(totalTimeSec) ? totalTimeSec : 0,
  };

  // createPractice handles POST /api/practices; headers (x-user-id / admin key)
  // should be set in your shared client or per-request as needed.
  const saved = await createPractice(
    {
      title,
      date: practiceDate,
      pool,
      roster: selectedRoster,
      season: season || undefined, // Only include if season is provided
      sections: sectionsForApi,
      totals,
      stats: stats || undefined, // Include stats if provided
    },
    // optional per-request headers if your client doesn't inject them globally:
    // { "x-user-id": userId }
  );

  return saved;
}

/**
 * Convenience passthrough to list practices (used elsewhere if needed)
 */
export async function fetchPractices(params = {}) {
  return listPractices(params);
}
