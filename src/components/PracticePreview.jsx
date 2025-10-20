import React, { useMemo } from "react";
import { parseYardage } from "../utils/yardageParser";
import {
  computeSectionTimeSeconds,
  formatSeconds,
  ceilToMinute,
  secondsFromHHMM,
  formatClock12,
} from "../utils/timeHelpers";

export default function PracticePreview({ practice, startTime = "06:00" }) {
    const sections = practice.sections || [];

    const sectionYardages = useMemo(
        () => sections.map(s => {
            const type = (s.type || "").toLowerCase();
            return type !== "break" ? parseYardage(s.text || s.content || "") : 0;
        }),
        [sections]
    );
    const sectionTimes = useMemo(
        () => sections.map(s => {
            const type = (s.type || "swim").toLowerCase();
            return computeSectionTimeSeconds({
                type: type === "break" ? "break" : "swim",
                content: s.text ?? s.content ?? ""
            });
        }), [sections]
    );
    const totalYardage = sectionYardages.reduce((a, b) => a + b, 0);
    const totalTimeSec = sectionTimes.reduce((a, b) => a + b, 0);

    // rounded end clocks for display
    const sectionEndClocks = useMemo(() => {
        let clock = secondsFromHHMM(startTime);
        return sectionTimes.map((dur) => {
            const endExact = clock + (dur || 0);
            const endDisplay = ceilToMinute(endExact);
            clock = endExact;
            return endDisplay;
        });
    }, [sectionTimes, startTime]);

    return (
        <div className="preview-panel">
            {sections.map((s, i) => {
                const type = (s.type || "").toLowerCase();
                return type === "break" ? (
                    <div key={s._id || i} className="preview-break">
                        {(s.title || s.name || "Break")}{(s.text || s.content) ? ` @ ${(s.text || s.content)}` : ""}
                    </div>
                ) : (
                    <div key={s._id || i} className="preview-section">
                        <div className="preview-title-row">
                            <div className="preview-title-left">
                                {(s.title || s.name || "Section")}
                                {sectionYardages[i] > 0 ? ` – ${sectionYardages[i].toLocaleString()}m` : ""}
                            </div>
                            <div className="preview-title-right">
                                {sectionTimes[i] > 0
                                    ? `${formatSeconds(sectionTimes[i])} → ${formatClock12(sectionEndClocks[i], false)}`
                                    : ""}
                            </div>
                        </div>
                        {(s.text || s.content || "").split("\n").map((line, li) => (
                            <div key={li} className="preview-line">
                                {line.trim() === "" ? <br /> : line}
                            </div>
                        ))}
                    </div>
                );
            })}

            <div className="preview-total-row">
                <div className="preview-total-left">
                    <strong>Total: {totalYardage.toLocaleString()}m</strong>
                </div>
                <div className="preview-total-right">
                    <strong>{totalTimeSec > 0 ? formatSeconds(totalTimeSec) : ""}</strong>
                </div>
            </div>
        </div>
    );
}
