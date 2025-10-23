import { formatTimeSeconds, formatClockTime, parseClockTime } from './intervalParser';

/**
 * Calculate clock times and sync information for all sections in a practice
 * @param {Array} sections - Array of practice sections
 * @param {string} startTime - Practice start time (e.g., "5:00 PM")
 * @returns {Object} - { sections: updatedSections, totals: groupTotals }
 */
export function calculatePracticeClockTimes(sections, startTime = "6:00") {
  if (!sections || sections.length === 0) {
    return { sections: [], totals: {} };
  }

  const startSeconds = parseClockTime(startTime);
  const updatedSections = [];
  const groupTotals = {}; // Track totals per group

  // Track current clock time for each group (all start together)
  const groupClocks = {};
  let currentClock = startSeconds; // For shared sections

  for (let i = 0; i < sections.length; i++) {
    const section = { ...sections[i] };

    if (section.type === 'group-split') {
      // Handle group split section
      const groups = section.groups || [];
      const updatedGroups = [];
      let longestTime = 0;
      let pacingGroupName = '';

      // Calculate times for each group
      for (const group of groups) {
        const groupCopy = { ...group };
        const groupName = group.name;

        // Initialize group clock if not exists (first split)
        if (!(groupName in groupClocks)) {
          groupClocks[groupName] = currentClock;
        }

        // Initialize group totals if not exists
        if (!(groupName in groupTotals)) {
          groupTotals[groupName] = {
            yardage: 0,
            timeSeconds: 0,
            actualSwimSeconds: 0
          };
        }

        // Start from current group clock
        let groupCurrentClock = groupClocks[groupName];

        // Calculate totals for this group's sections
        let groupYardage = 0;
        let groupTime = 0;

        for (const groupSection of (group.sections || [])) {
          groupYardage += groupSection.yardage || 0;
          groupTime += groupSection.timeSeconds || 0;
        }

        groupCopy.totalYardage = groupYardage;
        groupCopy.totalTimeSeconds = groupTime;

        // Update group clock
        groupCurrentClock += groupTime;
        groupCopy.clockTime = formatClockTime(groupCurrentClock);
        groupClocks[groupName] = groupCurrentClock;

        // Update group totals
        groupTotals[groupName].yardage += groupYardage;
        groupTotals[groupName].timeSeconds += groupTime;
        groupTotals[groupName].actualSwimSeconds += groupTime;

        // Track longest time
        if (groupTime > longestTime) {
          longestTime = groupTime;
          pacingGroupName = groupName;
        }

        updatedGroups.push(groupCopy);
      }

      // Calculate divergence (diff between fastest and slowest)
      const times = updatedGroups.map(g => g.totalTimeSeconds || 0);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const divergence = maxTime - minTime;

      section.groups = updatedGroups;
      section.longestTimeSeconds = longestTime;
      section.pacingGroup = pacingGroupName;
      section.divergenceSeconds = divergence;

      // After a split, next shared section will sync at the slowest group's time
      // Find the slowest group's clock time
      const slowestClock = Math.max(...Object.values(groupClocks));
      currentClock = slowestClock;

    } else {
      // Shared section (swim or break)
      const sectionTime = section.timeSeconds || 0;

      // Check if we need sync info (previous section was a split)
      if (i > 0 && sections[i - 1].type === 'group-split') {
        // Determine which groups need to wait
        const groupsWaiting = [];
        const slowestClock = Math.max(...Object.values(groupClocks));

        for (const [groupName, clockTime] of Object.entries(groupClocks)) {
          if (clockTime < slowestClock) {
            groupsWaiting.push(groupName);
            // Add waiting time to group totals (not actual swim time)
            const waitTime = slowestClock - clockTime;
            groupTotals[groupName].timeSeconds += waitTime;
          }
        }

        if (groupsWaiting.length > 0) {
          section.syncInfo = {
            syncedFrom: formatClockTime(slowestClock),
            groupsWaiting
          };
        }

        // Sync all groups to the slowest clock
        for (const groupName in groupClocks) {
          groupClocks[groupName] = slowestClock;
        }
        currentClock = slowestClock;
      }

      // Add section time to current clock
      currentClock += sectionTime;
      section.clockTime = formatClockTime(currentClock);

      // Update all group clocks for shared section
      for (const groupName in groupClocks) {
        groupClocks[groupName] = currentClock;
        groupTotals[groupName].timeSeconds += sectionTime;
        // Shared sections count as actual swim time
        groupTotals[groupName].actualSwimSeconds += sectionTime;
      }

      // Update shared yardage for all groups
      if (section.yardage > 0) {
        for (const groupName in groupTotals) {
          groupTotals[groupName].yardage += section.yardage;
        }
      }
    }

    updatedSections.push(section);
  }

  // Calculate overall practice end time
  const overallTimeSeconds = currentClock - startSeconds;

  return {
    sections: updatedSections,
    totals: {
      byGroup: groupTotals,
      overallTimeSeconds,
      endClockTime: formatClockTime(currentClock)
    }
  };
}

/**
 * Get groups from practice sections
 * @param {Array} sections - Practice sections
 * @returns {Array} - Array of unique group names
 */
export function getGroupNames(sections) {
  const groupNames = new Set();

  for (const section of sections) {
    if (section.type === 'group-split' && section.groups) {
      for (const group of section.groups) {
        if (group.name) {
          groupNames.add(group.name);
        }
      }
    }
  }

  return Array.from(groupNames);
}

/**
 * Check if practice has any group splits
 * @param {Array} sections - Practice sections
 * @returns {boolean}
 */
export function hasGroupSplits(sections) {
  return sections.some(s => s.type === 'group-split');
}

/**
 * Format sync message for display
 * @param {Object} syncInfo - Sync information object
 * @param {number} divergenceSeconds - Time difference
 * @returns {string} - Formatted sync message
 */
export function formatSyncMessage(syncInfo, divergenceSeconds) {
  if (!syncInfo || !syncInfo.groupsWaiting || syncInfo.groupsWaiting.length === 0) {
    return '';
  }

  const waitingGroups = syncInfo.groupsWaiting.join(', ');
  const waitTime = formatTimeSeconds(divergenceSeconds);

  return `${waitingGroups} wait${syncInfo.groupsWaiting.length === 1 ? 's' : ''} ${waitTime}`;
}

/**
 * Calculate totals for a practice (with or without group splits)
 * @param {Array} sections - Practice sections
 * @param {string} startTime - Practice start time
 * @returns {Object} - Totals object
 */
export function calculatePracticeTotals(sections, startTime = "6:00") {
  const hasGroups = hasGroupSplits(sections);

  if (!hasGroups) {
    // Simple totals for non-split practices
    let totalYardage = 0;
    let totalTime = 0;

    for (const section of sections) {
      totalYardage += section.yardage || 0;
      totalTime += section.timeSeconds || 0;
    }

    return {
      yardage: totalYardage,
      timeSeconds: totalTime
    };
  }

  // Calculate with groups
  const { totals } = calculatePracticeClockTimes(sections, startTime);
  return totals;
}
