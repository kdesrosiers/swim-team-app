/**
 * Parse practice content and categorize by swim type using acronyms config
 */

let acronymsConfig = null;

/**
 * Set the acronyms configuration
 * @param {object} config - Acronyms config with strokes and styles
 */
export function setAcronymsConfig(config) {
  acronymsConfig = config;
}

/**
 * Build regex patterns from acronyms config
 * @returns {object} - { strokes: {}, styles: {} }
 */
function buildPatterns() {
  if (!acronymsConfig) return { strokes: {}, styles: {} };

  const strokes = {};
  const styles = {};

  // Build stroke patterns
  for (const [stroke, acronyms] of Object.entries(acronymsConfig.strokes || {})) {
    if (Array.isArray(acronyms) && acronyms.length > 0) {
      const escaped = acronyms.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      strokes[stroke] = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
    }
  }

  // Build style patterns
  for (const [style, acronyms] of Object.entries(acronymsConfig.styles || {})) {
    if (Array.isArray(acronyms) && acronyms.length > 0) {
      const escaped = acronyms.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      styles[style] = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
    }
  }

  return { strokes, styles };
}

/**
 * Parse a single line to extract yardage, strokes, and styles
 * @param {string} line - Single line from practice content
 * @returns {object} - { yardage: number, strokes: object, styles: object }
 */
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return { yardage: 0, strokes: {}, styles: {} };

  let yardage = 0;
  const strokes = {};
  const styles = {};

  // Match format like: 3 x 100 or 4x75 Free
  const repMatch = trimmed.match(/^(\d+)\s*[xX]\s*(\d+)/);
  if (repMatch) {
    const reps = parseInt(repMatch[1], 10);
    const dist = parseInt(repMatch[2], 10);
    yardage = reps * dist;
  } else {
    // Match format like: 100 Free or 200 IM
    const singleMatch = trimmed.match(/^(\d+)\s*/);
    if (singleMatch) {
      yardage = parseInt(singleMatch[1], 10);
    }
  }

  if (yardage === 0) return { yardage: 0, strokes: {}, styles: {} };

  const patterns = buildPatterns();
  const foundStrokes = [];
  const foundStyles = [];

  // Check for combined styles like K/S/D/S or K-S-D-S (single letters with separators)
  const combinedStyleMatch = trimmed.match(/\b([KSPDW])(\/|-|\s)([KSPDW])((\/|-|\s)[KSPDW])*/gi);
  if (combinedStyleMatch && combinedStyleMatch.length > 0) {
    // Extract individual style letters from the combined pattern
    const styleLetters = combinedStyleMatch[0].split(/\/|-|\s+/).filter(s => s.length > 0);
    for (const letter of styleLetters) {
      for (const [style, pattern] of Object.entries(patterns.styles)) {
        if (pattern.test(letter)) {
          foundStyles.push(style);
          break;
        }
      }
    }
  }

  // Always check for normal style words (like "Drill", "Build", etc.) even if we found combined patterns
  if (foundStyles.length === 0) {
    for (const [style, pattern] of Object.entries(patterns.styles)) {
      if (pattern.test(trimmed)) {
        foundStyles.push(style);
      }
    }
  }

  // Detect strokes
  for (const [stroke, pattern] of Object.entries(patterns.strokes)) {
    if (pattern.test(trimmed)) {
      foundStrokes.push(stroke);
    }
  }

  // Apply rules:
  // - If no stroke designation, assume Choice
  if (foundStrokes.length === 0) {
    foundStrokes.push('Choice');
  }

  // - If no style designation, assume Swim
  if (foundStyles.length === 0) {
    foundStyles.push('Swim');
  }

  // If styles are put together (e.g., K/S/D/S), divide yardage amongst them
  const styleCount = foundStyles.length || 1;
  const strokeCount = foundStrokes.length || 1;
  const yardagePerStyle = yardage / styleCount;
  const yardagePerStroke = yardage / strokeCount;

  // Build result objects
  for (const style of foundStyles) {
    styles[style] = (styles[style] || 0) + yardagePerStyle;
  }

  for (const stroke of foundStrokes) {
    strokes[stroke] = (strokes[stroke] || 0) + yardagePerStroke;
  }

  return { yardage, strokes, styles };
}

/**
 * Expand blocks like "2 x { 100 Free, 100 Back }"
 * @param {string} text - Text with potential nested blocks
 * @returns {string} - Expanded text
 */
function expandBlocks(text) {
  let out = text;
  const pattern = /(\d+)\s*[xX]\s*{([^{}]*)}/s;

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
 * Parse practice content and return stats by strokes and styles
 * @param {string} content - Practice section content
 * @returns {object} - { strokes: {}, styles: {} }
 */
export function parseSwimTypeStats(content) {
  if (!content || typeof content !== 'string') {
    return { strokes: {}, styles: {} };
  }

  const expanded = expandBlocks(content);
  const lines = expanded.split('\n');

  const aggregatedStrokes = {};
  const aggregatedStyles = {};

  for (const line of lines) {
    const { yardage, strokes, styles } = parseLine(line);

    if (yardage > 0) {
      // Add stroke yardage
      for (const [stroke, strokeYardage] of Object.entries(strokes)) {
        aggregatedStrokes[stroke] = (aggregatedStrokes[stroke] || 0) + strokeYardage;
      }

      // Add style yardage
      for (const [style, styleYardage] of Object.entries(styles)) {
        aggregatedStyles[style] = (aggregatedStyles[style] || 0) + styleYardage;
      }
    }
  }

  return { strokes: aggregatedStrokes, styles: aggregatedStyles };
}

/**
 * Aggregate stats from all sections
 * @param {Array} sections - Array of section objects with content
 * @param {Array} sectionYardages - Pre-computed yardages per section
 * @returns {object} - Aggregated stats { strokes: {}, styles: {} }
 */
export function aggregatePracticeStats(sections, sectionYardages) {
  // Check if practice has group splits
  const hasGroupSplits = sections.some(s => s.type === 'group-split');

  if (!hasGroupSplits) {
    // No groups - return single aggregated stats
    const aggregated = { strokes: {}, styles: {} };

    sections.forEach((section, idx) => {
      if (section.type === 'swim' && section.content) {
        const sectionStats = parseSwimTypeStats(section.content);

        for (const [stroke, yardage] of Object.entries(sectionStats.strokes || {})) {
          aggregated.strokes[stroke] = (aggregated.strokes[stroke] || 0) + yardage;
        }

        for (const [style, yardage] of Object.entries(sectionStats.styles || {})) {
          aggregated.styles[style] = (aggregated.styles[style] || 0) + yardage;
        }
      }
    });

    return aggregated;
  }

  // Has groups - return per-group stats
  const groupStats = {}; // { groupName: { strokes: {}, styles: {}, totalYardage: 0, totalTime: 0 } }

  // Get all group names
  sections.forEach(section => {
    if (section.type === 'group-split' && section.groups) {
      section.groups.forEach(group => {
        if (!groupStats[group.name]) {
          groupStats[group.name] = {
            strokes: {},
            styles: {},
            totalYardage: 0,
            totalTime: 0
          };
        }
      });
    }
  });

  // Aggregate stats per group
  sections.forEach((section, idx) => {
    if (section.type === 'swim' && section.content) {
      // Shared section - add to all groups
      const sectionStats = parseSwimTypeStats(section.content);

      Object.keys(groupStats).forEach(groupName => {
        for (const [stroke, yardage] of Object.entries(sectionStats.strokes || {})) {
          groupStats[groupName].strokes[stroke] = (groupStats[groupName].strokes[stroke] || 0) + yardage;
        }

        for (const [style, yardage] of Object.entries(sectionStats.styles || {})) {
          groupStats[groupName].styles[style] = (groupStats[groupName].styles[style] || 0) + yardage;
        }
      });
    } else if (section.type === 'group-split' && section.groups) {
      // Group split section - add to specific group only
      section.groups.forEach(group => {
        (group.sections || []).forEach(groupSection => {
          if (groupSection.text) {
            const sectionStats = parseSwimTypeStats(groupSection.text);

            for (const [stroke, yardage] of Object.entries(sectionStats.strokes || {})) {
              groupStats[group.name].strokes[stroke] = (groupStats[group.name].strokes[stroke] || 0) + yardage;
            }

            for (const [style, yardage] of Object.entries(sectionStats.styles || {})) {
              groupStats[group.name].styles[style] = (groupStats[group.name].styles[style] || 0) + yardage;
            }
          }
        });
      });
    }
  });

  return groupStats;
}
