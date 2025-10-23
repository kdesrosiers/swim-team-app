// src/api/PracticeBuilder.js

import { createPractice, listPractices } from "./practices";

/**
 * Map builder UI sections -> API shape
 * Expects:
 *   sections: [{ id, name, type: 'swim'|'break'|'group-split', content, groups }]
 *   sectionYardages: number[]   // same order as sections
 *   sectionTimes: number[]      // same order as sections
 */
export function mapSectionsForApi(sections = [], sectionYardages = [], sectionTimes = []) {
  return sections.map((s, i) => {
    // Handle group-split sections
    if (s.type === "group-split") {
      return {
        type: "group-split",
        title: s.name || "Group Split",
        groups: s.groups || [],
        longestTimeSeconds: s.longestTimeSeconds,
        pacingGroup: s.pacingGroup,
        divergenceSeconds: s.divergenceSeconds,
      };
    }

    // Handle swim/break sections
    return {
      type: s.type === "break" ? "Break" : "swim",
      title: s.name || (s.type === "break" ? "Break" : "Section"),
      text: s.content || "",
      yardage: Number.isFinite(sectionYardages[i]) ? sectionYardages[i] : 0,
      timeSeconds: Number.isFinite(sectionTimes[i]) ? sectionTimes[i] : 0,
    };
  });
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
  startTime = "06:00",    // Start time for clock calculations
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
      startTime, // Include start time
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
