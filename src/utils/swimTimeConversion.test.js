import { parseTime, formatTime, convertTime } from "./swimTimeConversion";

// ─── parseTime ────────────────────────────────────────────────────────────────
describe("parseTime", () => {
  test("parses MM:SS.hh", () => expect(parseTime("1:23.45")).toBeCloseTo(83.45));
  test("parses SS.hh", () => expect(parseTime("59.99")).toBeCloseTo(59.99));
  test("parses single digit hundredths", () => expect(parseTime("25.4")).toBeCloseTo(25.40));
  test("parses M:SS.hh with leading zero secs", () => expect(parseTime("1:03.45")).toBeCloseTo(63.45));
  test("throws on empty string", () => expect(() => parseTime("")).toThrow());
  test("throws on invalid format", () => expect(() => parseTime("abc")).toThrow());
});

// ─── formatTime ───────────────────────────────────────────────────────────────
describe("formatTime", () => {
  test("sub-60 seconds", () => expect(formatTime(25.43)).toBe("25.43"));
  test("exactly 60 seconds", () => expect(formatTime(60.00)).toBe("1:00.00"));
  test("over 60 seconds", () => expect(formatTime(83.45)).toBe("1:23.45"));
  test("rounds to hundredth", () => expect(formatTime(63.456)).toBe("1:03.46"));
  test("leading zero on seconds < 10", () => expect(formatTime(65.50)).toBe("1:05.50"));
  test("throws on negative", () => expect(() => formatTime(-1)).toThrow());
});

// ─── convertTime — no-op ─────────────────────────────────────────────────────
describe("convertTime — no-op", () => {
  test("SCY → SCY returns input unchanged", () => {
    const result = convertTime("1:00.00", "SCY", "SCY", "FREE", 100);
    expect(result.convertedTime).toBe("1:00.00");
    expect(result.factor).toBe(1.0);
    expect(result.method).toBe("no_conversion");
  });
});

// ─── convertTime — Colorado standard events ──────────────────────────────────
describe("convertTime — SCY ↔ LCM standard events", () => {
  test("100 Free SCY→LCM (factor 1.1346): 1:04.99 → 1:13.74", () => {
    const { convertedTime } = convertTime("1:04.99", "SCY", "LCM", "FREE", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(64.99 * 1.1346, 1);
  });

  test("100 Free LCM→SCY is inverse", () => {
    const { convertedTime } = convertTime("1:00.00", "LCM", "SCY", "FREE", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(60 / 1.1346, 1);
  });

  test("200 Breast SCY→LCM (factor 1.1320): 3:01.99 → 3:26.01", () => {
    const { convertedTime } = convertTime("3:01.99", "SCY", "LCM", "BREAST", 200);
    expect(parseTime(convertedTime)).toBeCloseTo(181.99 * 1.1320, 1);
  });

  test("100 Back LCM→SCY (factor 1.1262)", () => {
    const { convertedTime } = convertTime("1:00.00", "LCM", "SCY", "BACK", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(60 / 1.1262, 1);
  });

  test("200 IM SCY→LCM (factor 1.1300): 2:39.99 → 3:00.79", () => {
    const { convertedTime } = convertTime("2:39.99", "SCY", "LCM", "IM", 200);
    expect(parseTime(convertedTime)).toBeCloseTo(159.99 * 1.1300, 1);
  });

  test("method is colorado for standard events", () => {
    const { method } = convertTime("1:00.00", "SCY", "LCM", "FREE", 100);
    expect(method).toBe("colorado");
  });
});

// ─── convertTime — SCY ↔ SCM ─────────────────────────────────────────────────
describe("convertTime — SCY ↔ SCM", () => {
  test("100 Free SCY→SCM: 50.00 → 55.50 (flat 1.11 factor)", () => {
    const { convertedTime } = convertTime("50.00", "SCY", "SCM", "FREE", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(50 * 1.11, 2);
  });

  test("100 Free SCY→SCM: 1:04.99 → 1:12.14", () => {
    const { convertedTime } = convertTime("1:04.99", "SCY", "SCM", "FREE", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(64.99 * 1.11, 2);
  });

  test("SCM→SCY is inverse of SCY→SCM", () => {
    const { convertedTime: scm } = convertTime("1:00.00", "SCY", "SCM", "FREE", 100);
    const { convertedTime: back } = convertTime(scm, "SCM", "SCY", "FREE", 100);
    expect(parseTime(back)).toBeCloseTo(60.00, 1);
  });

  test("500 Free SCY→SCM uses offset formula (×0.8925 − 6.40): 5:19.89 → 4:39.10", () => {
    const { convertedTime } = convertTime("5:19.89", "SCY", "SCM", "FREE", 500);
    expect(parseTime(convertedTime)).toBeCloseTo(319.89 * 0.8925 - 6.40, 2);
    expect(convertedTime).toBe("4:39.10");
  });
});

// ─── convertTime — SCM ↔ LCM flat rule ───────────────────────────────────────
describe("convertTime — SCM ↔ LCM flat 2%", () => {
  test("SCM→LCM: 1:00.00 → ~1:01.20", () => {
    const { convertedTime, method } = convertTime("1:00.00", "SCM", "LCM", "FREE", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(61.20, 1);
    expect(method).toBe("scm_lcm_flat");
  });

  test("LCM→SCM: 1:00.00 → ~58.82", () => {
    const { convertedTime } = convertTime("1:00.00", "LCM", "SCM", "FREE", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(60 / 1.02, 1);
  });
});

// ─── convertTime — long distance events ──────────────────────────────────────
describe("convertTime — LD events", () => {
  test("500 Free SCY→LCM (×0.8925): 5:19.89 → 4:45.50", () => {
    const { convertedTime, method } = convertTime("5:19.89", "SCY", "LCM", "FREE", 500);
    expect(parseTime(convertedTime)).toBeCloseTo(319.89 * 0.8925, 1);
    expect(method).toBe("ld_conversion");
  });

  test("400 Free LCM→SCY (÷0.8925): 4:45.50 → 5:19.89", () => {
    const { convertedTime } = convertTime("4:45.50", "LCM", "SCY", "FREE", 400);
    expect(parseTime(convertedTime)).toBeCloseTo(285.50 / 0.8925, 1);
  });

  test("1000 Free SCY→LCM (×0.8925): 11:06.89 → 9:55.20", () => {
    const { convertedTime } = convertTime("11:06.89", "SCY", "LCM", "FREE", 1000);
    expect(parseTime(convertedTime)).toBeCloseTo(666.89 * 0.8925, 1);
  });

  test("1650 Free SCY→LCM (×1.02): 18:39.59 → 19:01.98", () => {
    const { convertedTime, method } = convertTime("18:39.59", "SCY", "LCM", "FREE", 1650);
    expect(parseTime(convertedTime)).toBeCloseTo(1119.59 * 1.02, 1);
    expect(method).toBe("ld_conversion");
  });

  test("500 Free SCY→SCM ≠ SCY→LCM", () => {
    const { convertedTime: scm } = convertTime("5:19.89", "SCY", "SCM", "FREE", 500);
    const { convertedTime: lcm } = convertTime("5:19.89", "SCY", "LCM", "FREE", 500);
    expect(scm).not.toBe(lcm);
  });
});

// ─── convertTime — approximated strokes ──────────────────────────────────────
describe("convertTime — approximated events", () => {
  test("50 Back flags method as colorado_approximated", () => {
    const { method } = convertTime("30.00", "SCY", "LCM", "BACK", 50);
    expect(method).toBe("colorado_approximated");
  });

  test("50 Breast flags method as colorado_approximated", () => {
    const { method } = convertTime("35.00", "SCY", "LCM", "BREAST", 50);
    expect(method).toBe("colorado_approximated");
  });
});

// ─── convertTime — case insensitivity ────────────────────────────────────────
describe("convertTime — input normalization", () => {
  test("lowercase course names work", () => {
    const { convertedTime } = convertTime("1:00.00", "scy", "lcm", "free", 100);
    expect(parseTime(convertedTime)).toBeCloseTo(67.80, 0);
  });
});

// ─── convertTime — invalid inputs ────────────────────────────────────────────
describe("convertTime — error handling", () => {
  test("throws on unknown course", () => {
    expect(() => convertTime("1:00.00", "SCY", "LCY", "FREE", 100)).toThrow();
  });
});
