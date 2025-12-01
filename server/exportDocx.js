// server/exportDocx.js
import sanitize from "sanitize-filename";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  BorderStyle
} from "docx";
import {
  formatSeconds,
  ceilToMinute,
  secondsFromHHMM as parseStartSeconds,
  formatClock12,
  formatNumber,
} from "./utils/timeHelpers.js";

const TWIP = {
  inch: 1440,
  indent: 720, // 0.5"
};

// ----------------- Helpers -----------------
function p(text = "", opts = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    tabStops: opts.tabStops,
    children: [new TextRun({ text, bold: !!opts.bold })],
  });
}

function headerLine(leftText, rightText, rightTabPos) {
  // One paragraph with a right-aligned tab stop for the right column
  return new Paragraph({
    spacing: { before: 120, after: 60 },
    tabStops: [{ type: TabStopType.RIGHT, position: rightTabPos }],
    children: [
      new TextRun({ text: leftText, bold: true }),
      new TextRun({ text: "\t" }), // jump to the right tab stop
      new TextRun({ text: rightText, bold: true }),
    ],
  });
}
// -------------------------------------------

export async function exportPracticeToDocx(practice) {
  const {
    title = "Practice",         // e.g., "Practice 09/06/2025 — Senior" (built in frontend)
    date,                       // "YYYY-MM-DD" from the date picker (used for meta + filename)
    roster = "",
    pool = "",
    startTime = "06:00",        // "HH:MM" 24h from the UI
    sections = [],
    totals = { yardage: 0, timeSeconds: 0 },
  } = practice || {};

  // Page settings (US Letter, 1" margins)
  const pageWidth = 8.5 * TWIP.inch;
  const margin = 1 * TWIP.inch;
  const textWidth = pageWidth - margin * 2;
  const rightTab = margin + textWidth; // right edge for right-aligned tab

  const docChildren = [];

  // Title (use the provided title; do not recompute dates here)
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      children: [new TextRun(title)],
    })
  );

  // Meta line
  const metaBits = [];
  if (date) metaBits.push(`Date: ${date}`);
  if (roster) metaBits.push(`Roster: ${roster}`);
  if (pool) metaBits.push(`Pool: ${pool}`);
  if (startTime) {
    const startSec = parseStartSeconds(startTime);
    metaBits.push(`Start: ${formatClock12(startSec, false)}`);  // e.g. "6:30 PM"
  }

  if (metaBits.length) {
    docChildren.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: metaBits.join("   •   "), color: "666666" })],
      })
    );
  }

  // Running clock (seconds from midnight)
  let clock = parseStartSeconds(startTime);

  // Track totals for each group across the entire practice
  const groupTotals = {}; // { groupName: { yardage: 0, timeSeconds: 0 } }
  // Track shared sections before first split
  let preSplitYardage = 0;
  let preSplitTime = 0;

  sections.forEach((s) => {
    if (s?.type === "group-split") {
      // Handle group-split sections with a table
      const groups = s.groups || [];
      const longestTime = s.longestTimeSeconds || 0;
      const end = clock + longestTime;

      // Initialize group totals if this is the first group split
      // Add all pre-split shared sections to each group
      groups.forEach(group => {
        if (!groupTotals[group.name]) {
          groupTotals[group.name] = {
            yardage: preSplitYardage,
            timeSeconds: preSplitTime
          };
        }
        // Add this split's yardage and time to the group's running total
        groupTotals[group.name].yardage += group.totalYardage || 0;
        groupTotals[group.name].timeSeconds += group.totalTimeSeconds || 0;
      });

      // Create table for groups with individual headers (NO TOTALS ROW)
      const columnWidth = Math.floor(textWidth / groups.length);
      const tableRows = [];

      // Header row - each group has its own header with yardage and time FOR THIS SPLIT ONLY
      tableRows.push(
        new TableRow({
          children: groups.map(group => {
            const groupTime = group.totalTimeSeconds || 0;
            const groupEnd = clock + groupTime;
            const groupEndRounded = ceilToMinute(groupEnd);
            const leftText = `${group.name || "Group"} - ${formatNumber(group.totalYardage || 0)}m`;
            const rightText = `${formatSeconds(groupTime)}  \u2192  ${formatClock12(groupEndRounded, false)}`;

            return new TableCell({
              width: { size: columnWidth, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  tabStops: [{ type: TabStopType.RIGHT, position: columnWidth - 200 }],
                  children: [
                    new TextRun({ text: leftText, bold: true }),
                    new TextRun({ text: "\t" }),
                    new TextRun({ text: rightText, bold: true })
                  ]
                })
              ]
            });
          })
        })
      );

      // Find max number of lines across all groups (counting all text lines in all sections)
      const maxLines = Math.max(...groups.map(group => {
        return (group.sections || []).reduce((total, sec) => {
          return total + (sec.text || "").split("\n").length;
        }, 0);
      }), 0);

      // Content rows - display all practice text for each group
      const groupContentLines = groups.map(group => {
        const allLines = [];
        (group.sections || []).forEach(sec => {
          (sec.text || "").split("\n").forEach(line => {
            allLines.push(line);
          });
        });
        return allLines;
      });

      for (let i = 0; i < maxLines; i++) {
        tableRows.push(
          new TableRow({
            children: groups.map((_group, gIdx) => {
              const line = groupContentLines[gIdx][i] || "";
              return new TableCell({
                width: { size: columnWidth, type: WidthType.DXA },
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 0, bottom: 0, left: 200, right: 100 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: line || " " })]
                  })
                ]
              });
            })
          })
        );
      }

      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
        }
      });

      docChildren.push(table);
      clock = end;
      docChildren.push(p(" ", { before: 60, after: 120 }));
    } else {
      // Handle regular swim/break sections
      const dur = Number.isFinite(s?.timeSeconds) ? Math.max(0, s.timeSeconds) : 0;
      const end = clock + dur;
      const endRounded = ceilToMinute(end);

      const leftTitle =
        (s?.title || s?.type || "Section") +
        (Number.isFinite(s?.yardage) && s.yardage > 0 ? ` – ${formatNumber(s.yardage)}m` : "");

      const rightText = `${formatSeconds(dur)}  \u2192  ${formatClock12(endRounded, false)}`;

      docChildren.push(headerLine(leftTitle, rightText, rightTab));

      const lines = (s?.text || "").split("\n");
      lines.forEach((ln) => {
        docChildren.push(p(ln.trim() === "" ? " " : ln, { indent: TWIP.indent, before: 0, after: 0 }));
      });

      // Add shared section yardage/time
      const sectionYardage = s?.yardage ?? 0;

      // If groups have been initialized, add to all group totals
      if (Object.keys(groupTotals).length > 0) {
        Object.keys(groupTotals).forEach(groupName => {
          groupTotals[groupName].yardage += sectionYardage;
          groupTotals[groupName].timeSeconds += dur;
        });
      } else {
        // Otherwise, track as pre-split shared section
        preSplitYardage += sectionYardage;
        preSplitTime += dur;
      }

      clock = end;
      docChildren.push(p(" ", { before: 60, after: 60 }));
    }
  });

  const startSec = parseStartSeconds(startTime);

  // If practice has group splits, show individual group totals
  // Otherwise show single total
  if (Object.keys(groupTotals).length > 0) {
    Object.entries(groupTotals).forEach(([groupName, groupTotal]) => {
      const totalLeft = `${groupName} Total: ${formatNumber(groupTotal.yardage)}m`;
      const totalRight = groupTotal.timeSeconds > 0
        ? `${formatSeconds(groupTotal.timeSeconds)}  \u2192  ${formatClock12(ceilToMinute(startSec + groupTotal.timeSeconds), false)}`
        : "";
      docChildren.push(headerLine(totalLeft, totalRight, rightTab));
    });
  } else {
    const totalLeft = `Total: ${formatNumber(totals?.yardage ?? 0)}m`;
    const totalRight =
      (totals?.timeSeconds ?? 0) > 0
        ? `${formatSeconds(totals.timeSeconds)}  \u2192  ${formatClock12(ceilToMinute(startSec + (totals.timeSeconds || 0)), false)}`
        : "";
    docChildren.push(headerLine(totalLeft, totalRight, rightTab));
  }

  // Build document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: margin, right: margin, bottom: margin, left: margin },
            size: { width: pageWidth, height: 11 * TWIP.inch },
          },
        },
        children: docChildren,
      },
    ],
  });

  // Generate filename (sanitized)
  const safeTitle = (sanitize(title).trim() || "Practice").slice(0, 120);
  const filename = `${safeTitle}.docx`;

  // Convert document to buffer
  const buffer = await Packer.toBuffer(doc);

  // Return buffer and filename for download
  return { buffer, filename };
}
