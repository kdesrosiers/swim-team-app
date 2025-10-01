// server/exportDocx.js
import fs from "node:fs/promises";
import path from "node:path";
import sanitize from "sanitize-filename";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopType,
  TextRun
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

// ✅ Default absolute export directory (Windows)
const DEFAULT_EXPORT_DIR = "C:/Users/kdesr/Desktop/practices";

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

export async function exportPracticeToDocx(practice, outDir) {
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

  sections.forEach((s) => {
    const dur = Number.isFinite(s?.timeSeconds) ? Math.max(0, s.timeSeconds) : 0;
    const end = clock + dur;
    const endRounded = ceilToMinute(end);   // ⬅️ round display to next minute

    const leftTitle =
      (s?.title || s?.type || "Section") +
      (Number.isFinite(s?.yardage) && s.yardage > 0 ? ` – ${formatNumber(s.yardage)}m` : "");

    const rightText = `${formatSeconds(dur)}  \u2192  ${formatClock12(endRounded, false)}`;

    docChildren.push(headerLine(leftTitle, rightText, rightTab));

    const lines = (s?.text || "").split("\n");
    lines.forEach((ln) => {
      docChildren.push(p(ln.trim() === "" ? " " : ln, { indent: TWIP.indent, before: 0, after: 0 }));
    });

    clock = end;                 // advance by the exact duration
    docChildren.push(p(" ", { before: 60, after: 60 }));
  });

  const startSec = parseStartSeconds(startTime);
  const totalLeft = `Total: ${formatNumber(totals?.yardage ?? 0)}m`;
  const totalRight =
    (totals?.timeSeconds ?? 0) > 0
      ? `${formatSeconds(totals.timeSeconds)}  \u2192  ${formatClock12(ceilToMinute(startSec + (totals.timeSeconds || 0)), false)}`
      : "";

  docChildren.push(headerLine(totalLeft, totalRight, rightTab));

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

  // ✅ Always write to Desktop/practices unless an explicit outDir is passed
  const exportDir = outDir || DEFAULT_EXPORT_DIR;

  // Ensure output dir exists
  await fs.mkdir(exportDir, { recursive: true });

  // Filename (sanitized)
  const safeTitle = (sanitize(title).trim() || "Practice").slice(0, 120);
  const filePath = path.join(exportDir, `${safeTitle}.docx`);

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(filePath, buffer);
  return filePath;
}
