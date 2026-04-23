import { useMemo, useCallback } from "react";
import {
  convertTime as _convertTime,
  parseTime as _parseTime,
  formatTime as _formatTime,
  COLORADO_TIMING_FACTORS,
} from "../utils/swimTimeConversion";

/**
 * useSwimConversion
 *
 * React hook wrapping the swim time conversion utility.
 *
 * Usage:
 *   const { convert, parseTime, formatTime, factors } = useSwimConversion();
 *   const result = convert("1:05.32", "SCY", "LCM", "FREE", 100);
 *   // → { convertedTime: "1:13.81", factor: 1.13, method: "colorado" }
 */
export function useSwimConversion() {
  // Memoize the factor table reference so components can use it for display
  const factors = useMemo(() => COLORADO_TIMING_FACTORS, []);

  const convert = useCallback(
    (timeStr, fromCourse, toCourse, stroke, distance) => {
      try {
        return _convertTime(timeStr, fromCourse, toCourse, stroke, distance);
      } catch (err) {
        console.error("useSwimConversion.convert:", err.message);
        return { convertedTime: null, factor: null, method: null, error: err.message };
      }
    },
    []
  );

  const parseTime = useCallback((timeStr) => {
    try {
      return _parseTime(timeStr);
    } catch (err) {
      console.error("useSwimConversion.parseTime:", err.message);
      return null;
    }
  }, []);

  const formatTime = useCallback((totalSeconds) => {
    try {
      return _formatTime(totalSeconds);
    } catch (err) {
      console.error("useSwimConversion.formatTime:", err.message);
      return null;
    }
  }, []);

  return { convert, parseTime, formatTime, factors };
}
