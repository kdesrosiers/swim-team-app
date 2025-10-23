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
            if (type === "group-split") {
                // For group splits, use the pacing group's yardage (longest time)
                const groups = s.groups || [];
                return groups.reduce((max, g) => Math.max(max, g.totalYardage || 0), 0);
            }
            return type !== "break" ? parseYardage(s.text || s.content || "") : 0;
        }),
        [sections]
    );
    const sectionTimes = useMemo(
        () => sections.map(s => {
            const type = (s.type || "swim").toLowerCase();
            if (type === "group-split") {
                // For group splits, use the longest time
                return s.longestTimeSeconds || 0;
            }
            return computeSectionTimeSeconds({
                type: type === "break" ? "break" : "swim",
                content: s.text ?? s.content ?? ""
            });
        }), [sections]
    );
    const totalYardage = sectionYardages.reduce((a, b) => a + b, 0);
    const totalTimeSec = sectionTimes.reduce((a, b) => a + b, 0);

    // Calculate per-group totals if any group splits exist
    const groupTotals = useMemo(() => {
        const hasGroupSplits = sections.some(s => (s.type || "").toLowerCase() === "group-split");
        if (!hasGroupSplits) return null;

        const totals = {};
        let preSplitYardage = 0;
        let preSplitTime = 0;

        sections.forEach((section, idx) => {
            const type = (section.type || "").toLowerCase();

            if (type === "swim") {
                const yardage = sectionYardages[idx] || 0;
                const time = sectionTimes[idx] || 0;

                if (Object.keys(totals).length > 0) {
                    // After first split - add to all groups
                    Object.keys(totals).forEach(groupName => {
                        totals[groupName].yardage += yardage;
                        totals[groupName].timeSeconds += time;
                    });
                } else {
                    // Before first split - accumulate
                    preSplitYardage += yardage;
                    preSplitTime += time;
                }
            } else if (type === "group-split" && section.groups) {
                section.groups.forEach(group => {
                    if (!totals[group.name]) {
                        // Initialize with pre-split totals
                        totals[group.name] = {
                            yardage: preSplitYardage,
                            timeSeconds: preSplitTime
                        };
                    }
                    totals[group.name].yardage += group.totalYardage || 0;
                    totals[group.name].timeSeconds += group.totalTimeSeconds || 0;
                });
            }
        });

        return totals;
    }, [sections, sectionYardages, sectionTimes]);

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

                if (type === "break") {
                    return (
                        <div key={s._id || i} className="preview-break">
                            {(s.title || s.name || "Break")}{(s.text || s.content) ? ` @ ${(s.text || s.content)}` : ""}
                        </div>
                    );
                }

                if (type === "group-split") {
                    return (
                        <div key={s._id || i} className="preview-group-split">
                            <div className="preview-group-split-title">
                                {s.title || "Group Split"}
                            </div>
                            <div className="preview-groups">
                                {(s.groups || []).map((group, gi) => (
                                    <div key={group.id || gi} className="preview-group">
                                        <div className="preview-group-header">
                                            <strong>{group.name}</strong>
                                            {group.totalYardage > 0 && (
                                                <span> – {group.totalYardage.toLocaleString()}m</span>
                                            )}
                                            {group.totalTimeSeconds > 0 && (
                                                <span> @ {formatSeconds(group.totalTimeSeconds)}</span>
                                            )}
                                        </div>
                                        {(group.sections || []).map((gs, gsi) => (
                                            <div key={gs.id || gsi}>
                                                {(gs.text || "").split("\n").map((line, li) => (
                                                    <div key={li} className="preview-line">
                                                        {line.trim() === "" ? <br /> : line}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }

                return (
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

            {/* Show per-group totals if groups exist, otherwise show single total */}
            {groupTotals ? (
                <div className="preview-group-totals">
                    {Object.entries(groupTotals).map(([groupName, totals]) => (
                        <div key={groupName} className="preview-total-row">
                            <div className="preview-total-left">
                                <strong>{groupName} Total: {totals.yardage.toLocaleString()}m</strong>
                            </div>
                            <div className="preview-total-right">
                                <strong>{totals.timeSeconds > 0 ? formatSeconds(totals.timeSeconds) : ""}</strong>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="preview-total-row">
                    <div className="preview-total-left">
                        <strong>Total: {totalYardage.toLocaleString()}m</strong>
                    </div>
                    <div className="preview-total-right">
                        <strong>{totalTimeSec > 0 ? formatSeconds(totalTimeSec) : ""}</strong>
                    </div>
                </div>
            )}
        </div>
    );
}
