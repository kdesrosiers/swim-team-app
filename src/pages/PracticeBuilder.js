// src/pages/PracticeBuilder.js
import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import "./PracticeBuilder.css";
import { parseYardage } from "../utils/yardageParser";
import { exportPracticeDocx, updatePractice } from "../api/practices";
import { getConfig } from "../api/config";
import { getSeasons } from "../api/seasons";
import { getAcronyms } from "../api/acronyms";
import { handleSavePractice } from "../api/PracticeBuilder";
import {
  computeSectionTimeSeconds,
  formatSeconds,
  ceilToMinute,
  secondsFromHHMM,
  formatClock12,
  formatYardage,
} from "../utils/timeHelpers";
import { aggregatePracticeStats, setAcronymsConfig } from "../utils/statsParser";
import { calculateSectionTime, calculateSectionYardage } from "../utils/intervalParser";
import { calculatePracticeClockTimes, hasGroupSplits as checkHasGroupSplits } from "../utils/groupSyncCalculator";
import GroupSplitSection from "../components/GroupSplitSection";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function nextStartFor(config, roster, yyyyMmDd) {
  // Uses per-roster schedule: practiceSchedule[roster][dayKey] -> "HH:MM" or "OFF"
  if (!config?.practiceSchedule || !roster || !yyyyMmDd) return null;
  const week = config.practiceSchedule[roster];
  if (!week) return null;
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  const key = DOW[d.getDay()];
  const v = week[key];
  if (!v || v === "OFF") return null;
  return v; // "HH:MM"
}

function findSeasonByDate(seasons, yyyyMmDd) {
  // Find which season the date falls in
  if (!seasons || !Array.isArray(seasons) || !yyyyMmDd) return null;

  const date = new Date(yyyyMmDd);
  for (const season of seasons) {
    if (!season.startDate || !season.endDate) continue;

    const startDate = new Date(season.startDate);
    const endDate = new Date(season.endDate);

    if (date >= startDate && date <= endDate) {
      return season.title;
    }
  }

  return null;
}

// Find the index of the "Warm Up" section (case-insensitive)
function findWarmupIndex(sections) {
  const idx = sections.findIndex(
    (s) => s.type === "swim" && String(s.name || "").trim().toLowerCase() === "warm up"
  );
  return idx >= 0 ? idx : -1;
}


/* -------------------------------- */

function PracticeBuilder() {
  const location = useLocation();
  const incomingState = location.state || {};
  const editMode = incomingState.mode === "edit";
  const templateMode = incomingState.mode === "template";
  const incomingPractice = incomingState.practice;

  // Sections state
  const [sections, setSections] = useState([
    {
      id: "1",
      name: "Warm Up",
      type: "swim",
      content: `400 Free @ 10:00
4 x 100 K/S/D/S @ 2:00
4 x 50 Build @ :50`,
    },
    { id: "2", name: "Pre-Set", type: "swim", content: "" },
    { id: "3", name: "Break", type: "break", content: "5:00" },
    { id: "4", name: "Main Set", type: "swim", content: "" },
    { id: "5", name: "Cool Down", type: "swim", content: "200 EZ @ 5:00" },
  ]);

  const [showPreview, setShowPreview] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over?.id);
      setSections((items) => arrayMove(items, oldIndex, newIndex));
    }
  };

  // Top controls state
  const [practiceDate, setPracticeDate] = useState(
    new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  );
  const [config, setConfig] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [rosterOptions, setRosterOptions] = useState([]);
  const [selectedRoster, setSelectedRoster] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  // default to SCM
  const [pool, setPool] = useState("SCM");
  const [saving, setSaving] = useState(false);


  // Load config and seasons once
  useEffect(() => {
    (async () => {
      try {
        // Load config
        const cfg = await getConfig();
        setConfig(cfg || {});
        // Roster options from config
        const rosters =
          Array.isArray(cfg?.rosters) && cfg.rosters.length
            ? cfg.rosters
            : ["Yellow", "Blue", "White", "Bronze", "Silver", "Gold/Platinum"];
        setRosterOptions(rosters);

        // Load acronyms config
        const acronyms = await getAcronyms();
        setAcronymsConfig(acronyms || { strokes: {}, styles: {} });

        // Choose default: config.defaultRoster -> first roster
        const initial = (cfg?.defaultRoster && rosters.includes(cfg.defaultRoster))
          ? cfg.defaultRoster
          : rosters[0];

        setSelectedRoster(initial);

        // initial Start from today's weekday for the initial roster
        const todayKey = DOW[new Date().getDay()];
        const maybe = cfg?.practiceSchedule?.[initial]?.[todayKey];
        if (maybe && maybe !== "OFF") setStartTime(maybe);
      } catch (e) {
        console.error("Failed to load config", e);
        // sensible defaults if config not reachable
        const fallback = ["Yellow", "Blue", "White", "Bronze", "Silver", "Gold/Platinum"];
        setRosterOptions(fallback);
        if (!selectedRoster) setSelectedRoster(fallback[0]);
      }

      // Load seasons config
      try {
        const seasonsData = await getSeasons();
        setSeasons(seasonsData?.seasons || []);
      } catch (e) {
        console.error("Failed to load seasons", e);
        setSeasons([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load incoming practice data (for Edit or Template mode) - only once
  useEffect(() => {
    if (!incomingPractice) return;

    // Set date and roster
    if (templateMode) {
      // Use today's date for template mode
      setPracticeDate(new Date().toISOString().slice(0, 10));
    } else if (editMode && incomingPractice.date) {
      setPracticeDate(incomingPractice.date);
    }

    if (incomingPractice.roster) {
      setSelectedRoster(incomingPractice.roster);
    }

    if (incomingPractice.pool) {
      setPool(incomingPractice.pool);
    }

    // Map practice sections to builder format
    if (incomingPractice.sections && Array.isArray(incomingPractice.sections)) {
      const mappedSections = incomingPractice.sections.map((s, idx) => {
        const type = s.type?.toLowerCase();

        // Handle group-split sections
        if (type === "group-split") {
          // Deep clone groups and ensure all IDs exist
          const groups = (s.groups || []).map((group, gIdx) => ({
            ...group,
            id: group.id || `group-${Date.now()}-${gIdx}`,
            sections: (group.sections || []).map((gs, gsIdx) => ({
              ...gs,
              id: gs.id || `section-${Date.now()}-${gIdx}-${gsIdx}`
            }))
          }));

          return {
            id: String(idx + 1),
            name: s.title || "Group Split",
            type: "group-split",
            groups,
            longestTimeSeconds: s.longestTimeSeconds || 0,
            pacingGroup: s.pacingGroup || "",
            divergenceSeconds: s.divergenceSeconds || 0
          };
        }

        // Handle regular sections
        return {
          id: String(idx + 1),
          name: s.title || s.type || "Section",
          type: type === "break" ? "break" : "swim",
          content: s.text || ""
        };
      });
      setSections(mappedSections);
    }
    // Start time will be set by the next useEffect when date/roster/config are ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingPractice]);

  // When date or roster changes and we have config, adjust startTime from schedule (if defined)
  useEffect(() => {
    const st = nextStartFor(config, selectedRoster, practiceDate);
    if (st) setStartTime(st);
  }, [config, selectedRoster, practiceDate]);

  useEffect(() => {
    if (!config?.warmups || !selectedRoster) return;
    const preset = config.warmups[selectedRoster];
    if (!preset) return;

    setSections((prev) => {
      const idx = findWarmupIndex(prev);
      if (idx === -1) return prev; // no warmup section
      const next = [...prev];
      next[idx] = { ...next[idx], content: preset };
      return next;
    });
  }, [config, selectedRoster]);

  // Live yardage & time (per section + totals)
  const sectionYardages = useMemo(
    () => sections.map((s) => {
      if (s.type === "swim") return parseYardage(s.content);
      if (s.type === "group-split" && s.groups) {
        // For group splits, use the longest yardage among groups
        return Math.max(...s.groups.map(g => g.totalYardage || 0), 0);
      }
      return 0;
    }),
    [sections]
  );
  const sectionTimes = useMemo(
    () => sections.map((s) => {
      if (s.type === "group-split" && s.longestTimeSeconds != null) {
        return s.longestTimeSeconds;
      }
      return computeSectionTimeSeconds(s);
    }),
    [sections]
  );

  const totalYardage = sectionYardages.reduce((sum, v) => sum + v, 0);
  const totalTimeSec = sectionTimes.reduce((sum, v) => sum + v, 0);

  // Check if practice has group splits
  const hasGroupSplits = useMemo(() =>
    sections.some(s => s.type === 'group-split'),
    [sections]
  );

  // Compute stats by swim type (returns per-group stats if groups exist)
  const swimTypeStats = useMemo(() => {
    return aggregatePracticeStats(sections, sectionYardages);
  }, [sections, sectionYardages]);

  // Calculate totals per group (for practices with group splits)
  const groupTotals = useMemo(() => {
    if (!hasGroupSplits) return null;

    const totals = {};

    // Initialize with group names from group-split sections
    sections.forEach(section => {
      if (section.type === 'group-split' && section.groups) {
        section.groups.forEach(group => {
          if (!totals[group.name]) {
            totals[group.name] = { yardage: 0, timeSeconds: 0 };
          }
        });
      }
    });

    // Add shared section totals to all groups
    let preSplitYardage = 0;
    let preSplitTime = 0;

    sections.forEach((section, idx) => {
      if (section.type === 'swim') {
        const yardage = sectionYardages[idx] || 0;
        const time = sectionTimes[idx] || 0;

        if (Object.keys(totals).length > 0) {
          // Groups initialized - add to all groups
          Object.keys(totals).forEach(groupName => {
            totals[groupName].yardage += yardage;
            totals[groupName].timeSeconds += time;
          });
        } else {
          // Before first split - track for later
          preSplitYardage += yardage;
          preSplitTime += time;
        }
      } else if (section.type === 'group-split' && section.groups) {
        // Initialize groups with pre-split totals on first encounter
        section.groups.forEach(group => {
          if (totals[group.name].yardage === 0 && totals[group.name].timeSeconds === 0) {
            totals[group.name].yardage = preSplitYardage;
            totals[group.name].timeSeconds = preSplitTime;
          }
          // Add group-specific totals
          totals[group.name].yardage += group.totalYardage || 0;
          totals[group.name].timeSeconds += group.totalTimeSeconds || 0;
        });
      } else if (section.type === 'break') {
        const time = sectionTimes[idx] || 0;
        if (Object.keys(totals).length > 0) {
          Object.keys(totals).forEach(groupName => {
            totals[groupName].timeSeconds += time;
          });
        } else {
          preSplitTime += time;
        }
      }
    });

    return totals;
  }, [sections, sectionYardages, sectionTimes, hasGroupSplits]);

  // Recalculate group clock times and totals when needed
  // We'll do this on-demand in the save/export functions instead of in an effect
  // to avoid infinite loops

  // Preview end clocks (rounded up to the next minute)
  const sectionEndClocks = useMemo(() => {
    let clock = secondsFromHHMM(startTime); // seconds from midnight for Start:
    return sectionTimes.map((dur) => {
      const endExact = clock + (dur || 0); // exact end (includes seconds)
      const endDisplay = ceilToMinute(endExact); // rounded UP for display
      clock = endExact; // advance by exact, not rounded
      return endDisplay; // we display the rounded value
    });
  }, [sectionTimes, startTime]);

  // helper: purely string-based (no Date())
  function formatMDY(yyyyMmDd) {
    if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return "";
    const [y, m, d] = yyyyMmDd.split("-");
    return `${m}/${d}/${y}`;
  }

  async function onSave() {
    try {
      const seasonTitle = findSeasonByDate(seasons, practiceDate);
      const title = `Practice ${formatMDY(practiceDate)}${selectedRoster ? ` ${selectedRoster}` : ""}`;
      const date = practiceDate;
      const poolValue = pool;

      // Calculate clock times for group splits before saving
      const sectionsWithClockTimes = checkHasGroupSplits(sections)
        ? calculatePracticeClockTimes(sections, startTime).sections
        : sections;

      if (editMode && incomingPractice?._id) {
        // Update existing practice
        const sectionsForApi = sectionsWithClockTimes.map((s, i) => {
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
          return {
            type: s.type === "break" ? "Break" : "swim",
            title: s.name || (s.type === "break" ? "Break" : "Section"),
            text: s.content || "",
            yardage: Number.isFinite(sectionYardages[i]) ? sectionYardages[i] : 0,
            timeSeconds: Number.isFinite(sectionTimes[i]) ? sectionTimes[i] : 0,
          };
        });

        await updatePractice(incomingPractice._id, {
          title,
          date,
          pool: poolValue,
          roster: selectedRoster,
          season: seasonTitle || undefined,
          sections: sectionsForApi,
          totals: {
            yardage: totalYardage,
            timeSeconds: totalTimeSec,
          },
          stats: swimTypeStats || undefined,
        });

        toast.success("Practice updated successfully!");
      } else {
        // Create new practice
        await handleSavePractice({
          practiceTitle: title,
          practiceDate: date,
          pool: poolValue,
          selectedRoster,
          season: seasonTitle,
          sections: sectionsWithClockTimes, // pass sections with calculated clock times
          sectionYardages,
          sectionTimes,
          totalYardage,
          totalTimeSec,
          stats: swimTypeStats, // include computed stats
          startTime, // include start time for group clock calculations
        });

        toast.success("Practice saved successfully!");
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to save practice. Check console for details.");
    }
  }

  // Export
  async function handleExportDocx() {
    try {
      const niceDate = formatMDY(practiceDate);
      const title = `Practice ${niceDate}${selectedRoster ? ` ${selectedRoster}` : ""}`;
      const poolValue = pool;

      // Calculate clock times for group splits before exporting
      const sectionsWithClockTimes = checkHasGroupSplits(sections)
        ? calculatePracticeClockTimes(sections, startTime).sections
        : sections;

      const sectionsForApi = sectionsWithClockTimes.map((s, i) => {
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
        return {
          type: s.type === "break" ? "Break" : "swim",
          title: s.name || (s.type === "break" ? "Break" : "Section"),
          text: s.content || "",
          yardage: sectionYardages[i] ?? 0,
          timeSeconds: sectionTimes[i] ?? 0,
        };
      });

      const totals = { yardage: totalYardage, timeSeconds: totalTimeSec };

      const payload = {
        title,
        date: practiceDate,
        roster: selectedRoster,
        pool: poolValue,
        startTime,
        sections: sectionsForApi,
        totals,
      };

      const out = await exportPracticeDocx(payload);
      // Download triggered automatically, show success message
      if (out?.filename) {
        toast.success(`Downloaded: ${out.filename}`, { duration: 4000 });
      } else {
        toast.success("Export downloaded!");
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to export. Check console for details.");
    }
  }

  async function onSaveAndExport() {
    if (saving) return;
    setSaving(true);
    try {
      const seasonTitle = findSeasonByDate(seasons, practiceDate);
      const title = `Practice ${formatMDY(practiceDate)}${selectedRoster ? ` ${selectedRoster}` : ""}`;
      const date = practiceDate;
      const poolValue = pool;

      // Calculate clock times for group splits
      const sectionsWithClockTimes = checkHasGroupSplits(sections)
        ? calculatePracticeClockTimes(sections, startTime).sections
        : sections;

      const sectionsForApi = sectionsWithClockTimes.map((s, i) => {
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
        return {
          type: s.type === "break" ? "Break" : "swim",
          title: s.name || (s.type === "break" ? "Break" : "Section"),
          text: s.content || "",
          yardage: sectionYardages[i] ?? 0,
          timeSeconds: sectionTimes[i] ?? 0,
        };
      });

      const totals = { yardage: totalYardage, timeSeconds: totalTimeSec };

      // 1) SAVE (use the helper so it maps and persists consistently)
      await handleSavePractice({
        practiceTitle: title,
        practiceDate: date,
        pool: poolValue,
        selectedRoster,
        season: seasonTitle,
        sections: sectionsWithClockTimes,
        sectionYardages,
        sectionTimes,
        totalYardage,
        totalTimeSec,
        stats: swimTypeStats,
        startTime,
      });

      // 2) EXPORT (use the already-mapped sectionsForApi and include startTime)
      const out = await exportPracticeDocx({
        title,
        date,
        roster: selectedRoster,
        pool: poolValue,
        startTime,
        sections: sectionsForApi,
        totals,
      });

      toast.success(`Saved & downloaded: ${out.filename || "Practice.docx"}`, { duration: 4000 });
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Save & Export failed. Check console for details.");
    } finally {
      setSaving(false);
    }
  }

  // Reset to new practice
  const handleReset = () => {
    if (!window.confirm("Are you sure you want to start a new practice? Any unsaved changes will be lost.")) {
      return;
    }

    // Reset to default state
    setPracticeDate(new Date().toISOString().slice(0, 10));
    const defaultRosterFromConfig = config?.defaultRoster && rosterOptions.includes(config.defaultRoster)
      ? config.defaultRoster
      : rosterOptions[0] || "";
    setSelectedRoster(defaultRosterFromConfig);
    setPool("SCM");
    setSections([
      {
        id: "1",
        name: "Warm Up",
        type: "swim",
        content: `400 Free @ 10:00
4 x 100 K/S/D/S @ 2:00
4 x 50 Build @ :50`,
      },
      { id: "2", name: "Pre-Set", type: "swim", content: "" },
      { id: "3", name: "Break", type: "break", content: "5:00" },
      { id: "4", name: "Main Set", type: "swim", content: "" },
      { id: "5", name: "Cool Down", type: "swim", content: "200 EZ @ 5:00" },
    ]);

    // Clear incoming practice state by navigating to builder without state
    window.history.replaceState({}, document.title);

    toast.success("Started new practice");
  };

  // Section CRUD
  const addSwimSection = () => {
    const newId = Date.now().toString();
    setSections([...sections, { id: newId, name: "New Section", type: "swim", content: "" }]);
  };

  const addBreakSection = () => {
    const newId = Date.now().toString();
    setSections([...sections, { id: newId, name: "", type: "break", content: "" }]);
  };

  const addGroupSplitSection = () => {
    const newId = Date.now().toString();
    // Prompt for initial group names
    const group1Name = prompt('Enter first group name (e.g., Bronze):');
    if (!group1Name) return;

    const group2Name = prompt('Enter second group name (e.g., Silver):');
    if (!group2Name) return;

    const newSection = {
      id: newId,
      name: "Group Split",
      type: "group-split",
      title: "Group Split",
      groups: [
        {
          id: `group-${Date.now()}-1`,
          name: group1Name.trim(),
          sections: [],
          totalYardage: 0,
          totalTimeSeconds: 0
        },
        {
          id: `group-${Date.now()}-2`,
          name: group2Name.trim(),
          sections: [],
          totalYardage: 0,
          totalTimeSeconds: 0
        }
      ],
      longestTimeSeconds: 0,
      divergenceSeconds: 0
    };

    setSections([...sections, newSection]);
  };

  const deleteSection = (id) => {
    setSections(sections.filter((section) => section.id !== id));
  };

  const updateSection = (id, field, value) => {
    setSections(prevSections => prevSections.map((section) => {
      if (section.id === id) {
        // If updating groups, the value should already be deep cloned by the caller
        // but we'll ensure we're creating a new section object
        return { ...section, [field]: value };
      }
      return section;
    }));
  };

  // Group-specific CRUD operations
  const addGroupSection = (sectionId, groupId, newSection) => {
    setSections(prevSections => prevSections.map(section => {
      if (section.id === sectionId && section.type === 'group-split') {
        const updatedGroups = section.groups.map(group => {
          if (group.id === groupId) {
            const updatedSections = [...(group.sections || []).map(s => ({ ...s })), newSection];

            // Recalculate group totals
            const totalYardage = updatedSections.reduce((sum, s) => sum + (s.yardage || 0), 0);
            const totalTimeSeconds = updatedSections.reduce((sum, s) => sum + (s.timeSeconds || 0), 0);

            return {
              ...group,
              sections: updatedSections,
              totalYardage,
              totalTimeSeconds
            };
          }
          // Clone other groups and their sections
          return {
            ...group,
            sections: (group.sections || []).map(s => ({ ...s }))
          };
        });

        // Recalculate section-level totals
        const longestTimeSeconds = Math.max(...updatedGroups.map(g => g.totalTimeSeconds || 0), 0);
        const pacingGroup = updatedGroups.find(g => g.totalTimeSeconds === longestTimeSeconds)?.name || '';

        return {
          ...section,
          groups: updatedGroups,
          longestTimeSeconds,
          pacingGroup
        };
      }
      return section;
    }));
  };

  const deleteGroupSection = (sectionId, groupId, groupSectionId) => {
    setSections(prevSections => prevSections.map(section => {
      if (section.id === sectionId && section.type === 'group-split') {
        const updatedGroups = section.groups.map(group => {
          if (group.id === groupId) {
            const updatedSections = (group.sections || [])
              .filter(s => s.id !== groupSectionId)
              .map(s => ({ ...s }));

            // Recalculate group totals
            const totalYardage = updatedSections.reduce((sum, s) => sum + (s.yardage || 0), 0);
            const totalTimeSeconds = updatedSections.reduce((sum, s) => sum + (s.timeSeconds || 0), 0);

            return {
              ...group,
              sections: updatedSections,
              totalYardage,
              totalTimeSeconds
            };
          }
          // Clone other groups and their sections
          return {
            ...group,
            sections: (group.sections || []).map(s => ({ ...s }))
          };
        });

        // Recalculate section-level totals
        const longestTimeSeconds = Math.max(...updatedGroups.map(g => g.totalTimeSeconds || 0), 0);
        const pacingGroup = updatedGroups.find(g => g.totalTimeSeconds === longestTimeSeconds)?.name || '';

        return {
          ...section,
          groups: updatedGroups,
          longestTimeSeconds,
          pacingGroup
        };
      }
      return section;
    }));
  };

  const updateGroupSection = (sectionId, groupId, groupSectionId, field, value) => {
    setSections(prevSections => prevSections.map(section => {
      if (section.id === sectionId && section.type === 'group-split') {
        const updatedGroups = section.groups.map(group => {
          if (group.id === groupId) {
            const updatedSections = (group.sections || []).map(s => {
              if (s.id === groupSectionId) {
                const updated = { ...s, [field]: value };
                // Recalculate yardage and time when text changes
                if (field === 'text') {
                  updated.yardage = calculateSectionYardage(value);
                  updated.timeSeconds = calculateSectionTime(value);
                }
                return updated;
              }
              return { ...s }; // Clone other sections
            });

            // Recalculate group totals
            const totalYardage = updatedSections.reduce((sum, s) => sum + (s.yardage || 0), 0);
            const totalTimeSeconds = updatedSections.reduce((sum, s) => sum + (s.timeSeconds || 0), 0);

            return {
              ...group,
              sections: updatedSections,
              totalYardage,
              totalTimeSeconds
            };
          }
          // Clone other groups and their sections
          return {
            ...group,
            sections: (group.sections || []).map(s => ({ ...s }))
          };
        });

        // Recalculate section-level totals (longest time among groups)
        const longestTimeSeconds = Math.max(...updatedGroups.map(g => g.totalTimeSeconds || 0), 0);
        const pacingGroup = updatedGroups.find(g => g.totalTimeSeconds === longestTimeSeconds)?.name || '';

        return {
          ...section,
          groups: updatedGroups,
          longestTimeSeconds,
          pacingGroup
        };
      }
      return section;
    }));
  };

  return (
    <div className="builder-page">
      <div className="app-container">
        <h1 className="header">Practice Builder</h1>

        {/* Toolbar (top bar) */}
        <div className="toolbar">
          <div className="toolbar-right">
            <label className="pair">
              <span>Date:</span>
              <input
                type="date"
                value={practiceDate}
                onChange={(e) => setPracticeDate(e.target.value)}
              />
              {findSeasonByDate(seasons, practiceDate) && (
                <span className="season-badge">{findSeasonByDate(seasons, practiceDate)}</span>
              )}
            </label>

            <label className="pair">
              <span>Roster:</span>
              <select
                value={selectedRoster}
                onChange={(e) => setSelectedRoster(e.target.value)}
              >
                {rosterOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="pair">
              <span>Start:</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                step={60}
              />
            </label>

            <label className="pair">
              <span>Pool:</span>
              <select value={pool} onChange={(e) => setPool(e.target.value)}>
                <option value="SCM">SCM</option>
                <option value="SCY">SCY</option>
                <option value="LCM">LCM</option>
              </select>
            </label>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="builder-columns">
          {/* Left column: Sections */}
          <div className="builder-left">
            {/* Sections (DnD) */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              accessibility={{
                screenReaderInstructions: { draggable: "" },
                announcements: {
                  onDragStart: () => "",
                  onDragMove: () => "",
                  onDragOver: () => "",
                  onDragEnd: () => "",
                  onDragCancel: () => "",
                },
              }}
            >
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section, idx) => (
                  section.type === 'group-split' ? (
                    <GroupSplitSection
                      key={section.id}
                      section={section}
                      index={idx}
                      onUpdate={updateSection}
                      onDelete={deleteSection}
                      onAddGroupSection={addGroupSection}
                      onDeleteGroupSection={deleteGroupSection}
                      onUpdateGroupSection={updateGroupSection}
                    />
                  ) : (
                    <SortableSection
                      key={section.id}
                      section={section}
                      onChange={updateSection}
                      onDelete={deleteSection}
                      yardage={sectionYardages[idx]}
                      timeSec={sectionTimes[idx]}
                    />
                  )
                ))}
              </SortableContext>
            </DndContext>

            {/* Add buttons */}
            <div className="topbar">
              <div className="add-buttons">
                <button className="add-btn" onClick={addSwimSection}>+ Add Section</button>
                <button className="add-btn light" onClick={addBreakSection}>+ Add Break</button>
                <button className="add-btn" onClick={addGroupSplitSection}>+ Add Group Split</button>
              </div>
              <div className="actions">
                <button className="preview-btn" onClick={onSave}>💾 Save Practice</button>
                <button className="preview-btn" onClick={handleExportDocx}>⬇️ Export Word</button>
                <button className="preview-btn" onClick={onSaveAndExport} disabled={saving}>
                  💾⬇️ Save & Export
                </button>
                <button className="preview-btn secondary" onClick={handleReset}>🔄 New Practice</button>
              </div>
            </div>
          </div>

          {/* Right column: Preview and Stats */}
          <div className="builder-right">
            {/* Preview/Stats Toggle Buttons */}
            <div className="right-panel-controls">
              <button
                className={`toggle-btn ${showStats ? 'active' : ''}`}
                onClick={() => setShowStats(!showStats)}
              >
                {showStats ? '✓ ' : ''}Stats
              </button>
              <button
                className={`toggle-btn ${showPreview ? 'active' : ''}`}
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? '✓ ' : ''}Preview
              </button>
            </div>

            {/* Stats */}
            {showStats && (
              <div className="stats-panel">
                <h2 className="stats-title">Practice Statistics</h2>

                {!groupTotals ? (
                  // No groups - show single stats
                  <>
                    <div className="stats-summary">
                      <div className="stat-item">
                        <span className="stat-label">Total Yardage:</span>
                        <span className="stat-value">{formatYardage(totalYardage)}m</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Total Time:</span>
                        <span className="stat-value">{formatSeconds(totalTimeSec)}</span>
                      </div>
                    </div>

                    <h3 className="stats-subtitle">Breakdown by Strokes</h3>
                    <div className="stats-breakdown">
                      {Object.keys(swimTypeStats.strokes || {}).length === 0 ? (
                        <p className="stats-empty">No stroke data to analyze</p>
                      ) : (
                        <table className="stats-table">
                          <thead>
                            <tr>
                              <th>Stroke</th>
                              <th>Yardage</th>
                              <th>% of Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(swimTypeStats.strokes || {})
                              .sort((a, b) => b[1] - a[1])
                              .map(([stroke, yardage]) => {
                                const percentage = totalYardage > 0
                                  ? ((yardage / totalYardage) * 100).toFixed(1)
                                  : 0;
                                return (
                                  <tr key={stroke}>
                                    <td className="stat-type">{stroke}</td>
                                    <td className="stat-yardage">{formatYardage(yardage)}m</td>
                                    <td className="stat-percentage">{percentage}%</td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <h3 className="stats-subtitle" style={{ marginTop: 'var(--space-md)' }}>Breakdown by Styles</h3>
                    <div className="stats-breakdown">
                      {Object.keys(swimTypeStats.styles || {}).length === 0 ? (
                        <p className="stats-empty">No style data to analyze</p>
                      ) : (
                        <table className="stats-table">
                          <thead>
                            <tr>
                              <th>Style</th>
                              <th>Yardage</th>
                              <th>% of Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(swimTypeStats.styles || {})
                              .sort((a, b) => b[1] - a[1])
                              .map(([style, yardage]) => {
                                const percentage = totalYardage > 0
                                  ? ((yardage / totalYardage) * 100).toFixed(1)
                                  : 0;
                                return (
                                  <tr key={style}>
                                    <td className="stat-type">{style}</td>
                                    <td className="stat-yardage">{formatYardage(yardage)}m</td>
                                    <td className="stat-percentage">{percentage}%</td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                ) : (
                  // Has groups - show per-group stats
                  Object.entries(groupTotals).map(([groupName, totals]) => {
                    const groupStats = swimTypeStats[groupName] || { strokes: {}, styles: {} };
                    const groupYardage = totals.yardage;
                    const groupTime = totals.timeSeconds;

                    return (
                      <div key={groupName} style={{ marginBottom: 'var(--space-xl)' }}>
                        <h3 className="stats-subtitle" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                          {groupName}
                        </h3>

                        <div className="stats-summary">
                          <div className="stat-item">
                            <span className="stat-label">Total Yardage:</span>
                            <span className="stat-value">{formatYardage(groupYardage)}m</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Total Time:</span>
                            <span className="stat-value">{formatSeconds(groupTime)}</span>
                          </div>
                        </div>

                        <h4 className="stats-subtitle" style={{ fontSize: '1rem', marginTop: 'var(--space-sm)' }}>Breakdown by Strokes</h4>
                        <div className="stats-breakdown">
                          {Object.keys(groupStats.strokes || {}).length === 0 ? (
                            <p className="stats-empty">No stroke data</p>
                          ) : (
                            <table className="stats-table">
                              <thead>
                                <tr>
                                  <th>Stroke</th>
                                  <th>Yardage</th>
                                  <th>% of Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(groupStats.strokes || {})
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([stroke, yardage]) => {
                                    const percentage = groupYardage > 0
                                      ? ((yardage / groupYardage) * 100).toFixed(1)
                                      : 0;
                                    return (
                                      <tr key={stroke}>
                                        <td className="stat-type">{stroke}</td>
                                        <td className="stat-yardage">{formatYardage(yardage)}m</td>
                                        <td className="stat-percentage">{percentage}%</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          )}
                        </div>

                        <h4 className="stats-subtitle" style={{ fontSize: '1rem', marginTop: 'var(--space-sm)' }}>Breakdown by Styles</h4>
                        <div className="stats-breakdown">
                          {Object.keys(groupStats.styles || {}).length === 0 ? (
                            <p className="stats-empty">No style data</p>
                          ) : (
                            <table className="stats-table">
                              <thead>
                                <tr>
                                  <th>Style</th>
                                  <th>Yardage</th>
                                  <th>% of Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(groupStats.styles || {})
                                  .sort((a, b) => b[1] - a[1])
                                  .map(([style, yardage]) => {
                                    const percentage = groupYardage > 0
                                      ? ((yardage / groupYardage) * 100).toFixed(1)
                                      : 0;
                                    return (
                                      <tr key={style}>
                                        <td className="stat-type">{style}</td>
                                        <td className="stat-yardage">{formatYardage(yardage)}m</td>
                                        <td className="stat-percentage">{percentage}%</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Preview */}
            {showPreview && (
              <div className="preview-panel" style={{ marginTop: showStats ? 'var(--space-lg)' : '0' }}>
                {sections.map((section, index) =>
                  section.type === "break" ? (
                    <div key={section.id} className="preview-break">
                      {section.name || "Break"}
                      {section.content ? ` @ ${section.content}` : ""}
                    </div>
                  ) : section.type === "group-split" ? (
                    <div key={section.id} className="preview-section group-split-preview">
                      <div className="preview-title-row">
                        <div className="preview-title-left">
                          <strong>{section.name || section.title || "Group Split"}</strong>
                        </div>
                      </div>
                      <div className="group-split-preview-content">
                        {(section.groups || []).map(group => (
                          <div key={group.id} className="group-preview">
                            <div className="group-preview-header">
                              <strong>{group.name}</strong>
                              {section.pacingGroup === group.name && <span> 🏃</span>}
                            </div>
                            {(group.sections || []).map((groupSection, idx) => (
                              <div key={idx} className="preview-line">
                                {groupSection.text || ''}
                              </div>
                            ))}
                            <div className="group-preview-totals">
                              {group.totalYardage}m • {formatSeconds(group.totalTimeSeconds || 0)}
                              {group.clockTime && ` → ${group.clockTime}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div key={section.id} className="preview-section">
                      <div className="preview-title-row">
                        <div className="preview-title-left">
                          {section.name}
                          {sectionYardages[index] > 0 ? ` – ${formatYardage(sectionYardages[index])}m` : ""}
                        </div>
                        <div className="preview-title-right">
                          {sectionTimes[index] > 0
                            ? `${formatSeconds(sectionTimes[index])} \u2192 ${formatClock12(sectionEndClocks[index], false)}`
                            : ""}
                        </div>
                      </div>

                      {section.content.split("\n").map((line, i) => (
                        <div key={i} className="preview-line">
                          {line.trim() === "" ? <br /> : line}
                        </div>
                      ))}
                    </div>
                  )
                )}

                <div className="preview-total-row">
                  <div className="preview-total-left">
                    <strong>Total: {formatYardage(totalYardage)}m</strong>
                  </div>
                  <div className="preview-total-right">
                    <strong>{totalTimeSec > 0 ? formatSeconds(totalTimeSec) : ""}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableSection({ section, onChange, onDelete, yardage, timeSec }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="practice-section">
      {section.type === "break" ? (
        <div className="break-inline" {...attributes} {...listeners}>
          <button className="drag-handle" aria-label="Drag section" {...attributes} {...listeners}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <input
            type="text"
            className="section-name-input"
            placeholder="Break Name"
            value={section.name}
            onChange={(e) => onChange(section.id, "name", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <input
            type="text"
            className="break-input"
            placeholder="e.g. 5:00"
            value={section.content}
            onChange={(e) => onChange(section.id, "content", e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />

          <button className="delete-btn" onClick={() => onDelete(section.id)}>
            ❌
          </button>
        </div>
      ) : (
        <>
          <div className="section-header" {...attributes} {...listeners}>
            <button className="drag-handle" aria-label="Drag section">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <input
              type="text"
              className="section-name-input"
              value={section.name}
              onChange={(e) => onChange(section.id, "name", e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />

            {yardage > 0 && <span className="yardage-display"> {formatYardage(yardage)}m</span>}
            {timeSec > 0 && <span className="yardage-display"> @ {formatSeconds(timeSec)}</span>}
            <button className="delete-btn" onClick={() => onDelete(section.id)}>
              ❌
            </button>
          </div>

          <textarea
            className="practice-input"
            placeholder="e.g. 3x100 Free @ 1:30"
            value={section.content}
            onChange={(e) => onChange(section.id, "content", e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation(); // keep space/tab working inside textarea
              if (e.key === "Tab") {
                e.preventDefault();
                const el = e.target;
                const { selectionStart, selectionEnd } = el;
                const updated =
                  section.content.slice(0, selectionStart) +
                  "\t" +
                  section.content.slice(selectionEnd);
                onChange(section.id, "content", updated);
                setTimeout(() => {
                  el.selectionStart = el.selectionEnd = selectionStart + 1;
                }, 0);
              }
            }}
          />
        </>
      )}
    </div>
  );
}

export default PracticeBuilder;
