// server/models.js
import mongoose from "mongoose";

/** A single section in a practice (swim or break) */
const SectionSchema = new mongoose.Schema(
  {
    // For non-breaks, we store the section header in both `type` and `title`
    // (historical compatibility with earlier saves)
    type: { type: String },         // e.g., "Warm Up" | "Main Set" | "Break"
    title: { type: String },        // display title (same as type for swim sections)
    text: { type: String },         // multi-line body
    yardage: { type: Number },      // computed yardage for that section
    timeSeconds: { type: Number },  // computed duration in seconds
  },
  { _id: false }
);

/** A saved practice */
const PracticeSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },         // "kyle" (from x-user-id header)
    date:   { type: String, required: true },      // "YYYY-MM-DD" from date picker
    roster: { type: String, index: true },         // e.g., "Yellow"
    pool:   { type: String },                      // e.g., "SCY" | "SCM" (optional)
    title:  { type: String },                      // e.g., "Practice 09/07/2025 — Yellow"

    sections: [SectionSchema],
    totals: {
      yardage: { type: Number, default: 0 },
      timeSeconds: { type: Number, default: 0 },
    },

    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// ---- Indexes ----
// Keep either inline `index: true` on fields above OR these schema.index() calls,
// but don't duplicate both in different files.

PracticeSchema.index({ date: 1, roster: 1 });  // for library filtering/sorting
// userId already has inline index: true above

// Export as a named export `Practice`
export const Practice = mongoose.model("Practice", PracticeSchema);
