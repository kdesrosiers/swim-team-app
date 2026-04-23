/**
 * swimTimeConversion.js
 *
 * Converts competitive swimming times between SCY, SCM, and LCM using the
 * Colorado Timing factor methodology — the same industry standard used by
 * USA Swimming, TeamUnify/SportsEngine, and SwimSwam.
 *
 * All conversions are estimates. Output is rounded to the nearest hundredth.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Colorado Timing Factors: SCY → LCM multipliers
// Source: Colorado Timing / USA Swimming standard
// ─────────────────────────────────────────────────────────────────────────────
export const COLORADO_TIMING_FACTORS = {
  FREE: {
    50:   1.1367,
    100:  1.1346,
    200:  1.1328,
    // 400/500/800/1000/1500/1650 handled via LD logic
  },
  BACK: {
    50:   1.1274,
    100:  1.1262,
    200:  1.1250,
  },
  BREAST: {
    50:   1.1364,
    100:  1.1333,
    200:  1.1320,
  },
  FLY: {
    50:   1.1316,
    100:  1.1283,
    200:  1.1261,
  },
  IM: {
    200:  1.1300,
    400:  1.1288,
  },
};

// Approximated strokes/distances flagged in method string
const APPROXIMATED = new Set(["BACK:50", "BREAST:50", "FLY:50"]);

// SCM ↔ LCM flat factor
const SCM_TO_LCM = 1.02;
const LCM_TO_SCM = 1 / SCM_TO_LCM; // ≈ 0.9804

// SCY ↔ SCM flat factor (empirically validated; not derived from Colorado SCY→LCM factors)
const SCY_TO_SCM = 1.11;
const SCM_TO_SCY = 1 / SCY_TO_SCM;

// Long-distance event pairings
// lcmFactor: multiply SCY time to get LCM time (different distances: 500y↔400m, 1000y↔800m, 1650y↔1500m)
// scmOffset: SCM = (SCY × lcmFactor) − scmOffset  |  reverse: SCY = (SCM + scmOffset) / lcmFactor
// SCM ↔ LCM (same distance): SCM → LCM = SCM + scmOffset  |  LCM → SCM = LCM − scmOffset
const LD_PAIRINGS_SCY = {
  500:  { lcmDist: 400,  lcmFactor: 0.8925, scmOffset:  6.40 },
  1000: { lcmDist: 800,  lcmFactor: 0.8925, scmOffset: 12.80 },
  1650: { lcmDist: 1500, lcmFactor: 1.0200, scmOffset: 24.00 },
};

// Reverse lookup: metric LD distances → their SCY counterpart
const LD_PAIRINGS_METRIC = {
  400:  { scyDist: 500,  lcmFactor: 0.8925, scmOffset:  6.40 },
  800:  { scyDist: 1000, lcmFactor: 0.8925, scmOffset: 12.80 },
  1500: { scyDist: 1650, lcmFactor: 1.0200, scmOffset: 24.00 },
};

// 400 IM SCY↔LCM uses an intercept formula (not a pure Colorado multiplier)
// LCM = SCY × 1.11 + 6.40  |  reverse: SCY = (LCM − 6.40) / 1.11
const IM_400_LCM_FACTOR = 1.11;
const IM_400_LCM_INTERCEPT = 6.40;

// Relay event lookup: keyed by "STROKE_KEY:SCY_DISTANCE"
// SCY ↔ SCM: always flat × 1.11 for all relays (falls through to standard path)
// SCY → LCM: SCY × lcmFactor + lcmOffset
// LCM → SCY: (LCM − lcmOffset) / lcmFactor
// SCM ↔ LCM: chain through SCY using the above
const RELAY_EVENTS = {
  "FREE_RELAY:200":   { lcmFactor: 1.11,   lcmOffset: 3.00 },
  "MEDLEY_RELAY:200": { lcmFactor: 1.11,   lcmOffset: 3.00 },
  "FREE_RELAY:400":   { lcmFactor: 1.11,   lcmOffset: 6.40 },
  "MEDLEY_RELAY:400": { lcmFactor: 1.11,   lcmOffset: 6.40 },
  "FREE_RELAY:800":   { lcmFactor: 0.8925, lcmOffset: 0    },
};

// Default fallback factor when event not in table
const FALLBACK_SCY_LCM = 1.11;

// ─────────────────────────────────────────────────────────────────────────────
// parseTime — "1:23.45" or "59.99" → seconds as float
// ─────────────────────────────────────────────────────────────────────────────
export function parseTime(timeStr) {
  if (typeof timeStr !== "string" || !timeStr.trim()) {
    throw new Error(`parseTime: invalid input "${timeStr}"`);
  }

  const s = timeStr.trim();

  // Format: M:SS.hh or MM:SS.hh
  const colonMatch = s.match(/^(\d+):(\d{2})\.(\d{1,2})$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10);
    const seconds = parseInt(colonMatch[2], 10);
    const hundredths = colonMatch[3].padEnd(2, "0");
    if (seconds >= 60) throw new Error(`parseTime: seconds out of range in "${timeStr}"`);
    return minutes * 60 + seconds + parseInt(hundredths, 10) / 100;
  }

  // Format: SS.hh (no colon)
  const plainMatch = s.match(/^(\d+)\.(\d{1,2})$/);
  if (plainMatch) {
    const seconds = parseInt(plainMatch[1], 10);
    const hundredths = plainMatch[2].padEnd(2, "0");
    return seconds + parseInt(hundredths, 10) / 100;
  }

  // Format: integer seconds (rare but handle gracefully)
  const intMatch = s.match(/^\d+$/);
  if (intMatch) return parseInt(s, 10);

  throw new Error(`parseTime: unrecognized time format "${timeStr}". Expected "SS.hh" or "M:SS.hh".`);
}

// ─────────────────────────────────────────────────────────────────────────────
// formatTime — seconds float → "SS.hh" or "M:SS.hh"
// ─────────────────────────────────────────────────────────────────────────────
export function formatTime(totalSeconds) {
  if (typeof totalSeconds !== "number" || isNaN(totalSeconds) || totalSeconds < 0) {
    throw new Error(`formatTime: invalid input ${totalSeconds}`);
  }

  const rounded = Math.round(totalSeconds * 100) / 100;

  if (rounded < 60) {
    return rounded.toFixed(2);
  }

  const minutes = Math.floor(rounded / 60);
  const secs = rounded - minutes * 60;
  const secStr = secs < 10 ? `0${secs.toFixed(2)}` : secs.toFixed(2);
  return `${minutes}:${secStr}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// _getScyLcmFactor — internal: look up SCY→LCM factor for a given stroke+dist
// Returns { factor, method }
// ─────────────────────────────────────────────────────────────────────────────
function _getScyLcmFactor(stroke, distance) {
  const strokeKey = stroke.toUpperCase();
  const dist = Number(distance);

  // LD events — detected by SCY distance
  if (LD_PAIRINGS_SCY[dist]) {
    return { factor: LD_PAIRINGS_SCY[dist].lcmFactor, method: "ld_conversion" };
  }

  const strokeTable = COLORADO_TIMING_FACTORS[strokeKey];
  if (strokeTable && strokeTable[dist] !== undefined) {
    const isApproximated = APPROXIMATED.has(`${strokeKey}:${dist}`);
    return {
      factor: strokeTable[dist],
      method: isApproximated ? "colorado_approximated" : "colorado",
    };
  }

  // Fallback
  console.warn(
    `swimTimeConversion: no factor for ${strokeKey} ${dist} — using fallback ${FALLBACK_SCY_LCM}`
  );
  return { factor: FALLBACK_SCY_LCM, method: "colorado_fallback" };
}

// ─────────────────────────────────────────────────────────────────────────────
// convertTime — main public function
// ─────────────────────────────────────────────────────────────────────────────
export function convertTime(timeStr, fromCourse, toCourse, stroke, distance) {
  const from = fromCourse.toUpperCase();
  const to = toCourse.toUpperCase();

  for (const c of [from, to]) {
    if (!["SCY", "SCM", "LCM"].includes(c)) {
      throw new Error(`convertTime: unknown course "${c}". Must be SCY, SCM, or LCM.`);
    }
  }

  // No-op
  if (from === to) {
    return { convertedTime: timeStr, factor: 1.0, method: "no_conversion" };
  }

  const inputSeconds = parseTime(timeStr);
  const dist = Number(distance);

  const strokeKey = stroke.toUpperCase();
  const relayKey = `${strokeKey}:${dist}`;
  const relay = RELAY_EVENTS[relayKey];

  // ── Relay events ────────────────────────────────────────────────────────────
  if (relay) {
    const { lcmFactor, lcmOffset } = relay;

    if (from === "SCY" && to === "SCM") {
      return { convertedTime: formatTime(inputSeconds * SCY_TO_SCM), factor: SCY_TO_SCM, method: "relay" };
    }
    if (from === "SCM" && to === "SCY") {
      return { convertedTime: formatTime(inputSeconds * SCM_TO_SCY), factor: Math.round(SCM_TO_SCY * 10000) / 10000, method: "relay" };
    }
    if (from === "SCY" && to === "LCM") {
      return { convertedTime: formatTime(inputSeconds * lcmFactor + lcmOffset), factor: null, method: "relay" };
    }
    if (from === "LCM" && to === "SCY") {
      return { convertedTime: formatTime((inputSeconds - lcmOffset) / lcmFactor), factor: null, method: "relay" };
    }
    if (from === "SCM" && to === "LCM") {
      // Chain: SCM → SCY → LCM
      const scySec = inputSeconds * SCM_TO_SCY;
      return { convertedTime: formatTime(scySec * lcmFactor + lcmOffset), factor: null, method: "relay" };
    }
    if (from === "LCM" && to === "SCM") {
      // Chain: LCM → SCY → SCM
      const scySec = (inputSeconds - lcmOffset) / lcmFactor;
      return { convertedTime: formatTime(scySec * SCY_TO_SCM), factor: null, method: "relay" };
    }
  }

  // ── SCM ↔ LCM ──────────────────────────────────────────────────────────────
  if ((from === "SCM" && to === "LCM") || (from === "LCM" && to === "SCM")) {
    // LD metric events (400/800/1500 free): same distance, use offset formula
    // SCM → LCM: SCM + scmOffset  |  LCM → SCM: LCM − scmOffset
    if (LD_PAIRINGS_METRIC[dist] && strokeKey === "FREE") {
      const { scmOffset } = LD_PAIRINGS_METRIC[dist];
      const convertedSeconds = from === "SCM"
        ? inputSeconds + scmOffset
        : inputSeconds - scmOffset;
      return {
        convertedTime: formatTime(convertedSeconds),
        factor: null,
        method: "ld_conversion",
      };
    }
    // Standard: flat 2% rule
    const factor = from === "SCM" ? SCM_TO_LCM : LCM_TO_SCM;
    const convertedSeconds = inputSeconds * factor;
    return {
      convertedTime: formatTime(convertedSeconds),
      factor: Math.round(factor * 10000) / 10000,
      method: "scm_lcm_flat",
    };
  }

  // ── SCY → LCM ──────────────────────────────────────────────────────────────
  if (from === "SCY" && to === "LCM") {
    // 400 IM: LCM = SCY × 1.11 + 6.40
    if (strokeKey === "IM" && dist === 400) {
      return {
        convertedTime: formatTime(inputSeconds * IM_400_LCM_FACTOR + IM_400_LCM_INTERCEPT),
        factor: null,
        method: "im_400_lcm",
      };
    }
    const { factor, method } = _getScyLcmFactor(stroke, dist);
    const convertedSeconds = inputSeconds * factor;
    return {
      convertedTime: formatTime(convertedSeconds),
      factor,
      method,
    };
  }

  // ── LCM → SCY ──────────────────────────────────────────────────────────────
  if (from === "LCM" && to === "SCY") {
    // 400 IM: SCY = (LCM − 6.40) / 1.11
    if (strokeKey === "IM" && dist === 400) {
      return {
        convertedTime: formatTime((inputSeconds - IM_400_LCM_INTERCEPT) / IM_400_LCM_FACTOR),
        factor: null,
        method: "im_400_lcm",
      };
    }
    const ldPairing = LD_PAIRINGS_METRIC[dist];
    if (ldPairing && strokeKey === "FREE") {
      const convertedSeconds = inputSeconds / ldPairing.lcmFactor;
      return {
        convertedTime: formatTime(convertedSeconds),
        factor: Math.round((1 / ldPairing.lcmFactor) * 10000) / 10000,
        method: "ld_conversion",
      };
    }

    // Standard: use SCY→LCM factor in reverse
    const { factor, method } = _getScyLcmFactor(stroke, dist);
    const convertedSeconds = inputSeconds / factor;
    return {
      convertedTime: formatTime(convertedSeconds),
      factor: Math.round((1 / factor) * 10000) / 10000,
      method,
    };
  }

  // ── SCY → SCM ──────────────────────────────────────────────────────────────
  if (from === "SCY" && to === "SCM") {
    if (LD_PAIRINGS_SCY[dist]) {
      const { lcmFactor, scmOffset } = LD_PAIRINGS_SCY[dist];
      return {
        convertedTime: formatTime(inputSeconds * lcmFactor - scmOffset),
        factor: null,
        method: "ld_conversion",
      };
    }

    // Standard: use flat SCY→SCM factor of 1.11
    return {
      convertedTime: formatTime(inputSeconds * SCY_TO_SCM),
      factor: SCY_TO_SCM,
      method: "colorado",
    };
  }

  // ── SCM → SCY ──────────────────────────────────────────────────────────────
  if (from === "SCM" && to === "SCY") {
    const ldPairing = LD_PAIRINGS_METRIC[dist];
    if (ldPairing && strokeKey === "FREE") {
      return {
        convertedTime: formatTime((inputSeconds + ldPairing.scmOffset) / ldPairing.lcmFactor),
        factor: null,
        method: "ld_conversion",
      };
    }

    // Standard: inverse of flat SCY→SCM factor
    return {
      convertedTime: formatTime(inputSeconds * SCM_TO_SCY),
      factor: Math.round(SCM_TO_SCY * 10000) / 10000,
      method: "colorado",
    };
  }

  throw new Error(`convertTime: unhandled conversion path ${from} → ${to}`);
}
