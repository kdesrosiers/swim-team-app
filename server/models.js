// server/models.js
import mongoose from "mongoose";

/**
 * Looser section schema:
 * - no enum on `type`
 * - `title` and `text` are optional (default to "")
 * - safe defaults for yardage/timeSeconds
 */
const SectionSchema = new mongoose.Schema(
  {
    type: { type: String, default: "" },       // e.g., "Warm Up", "Break", "Main Set"
    title: { type: String, default: "" },      // display label
    text: { type: String, default: "" },       // raw textarea content
    yardage: { type: Number, default: 0 },
    timeSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * Practice: relaxed validation so the UI can send whatever it has.
 * - `title` optional (default "Untitled Practice")
 * - `date` stored as string YYYY-MM-DD (optional)
 * - `pool` any string (default "SCY")
 * - `sections` accepts loose SectionSchema
 */
const PracticeSchema = new mongoose.Schema({
  userId: { type: String, index: true, default: "kyle" },
  title: { type: String, default: "Untitled Practice" },
  date: { type: String, default: "" },               // YYYY-MM-DD
  pool: { type: String, default: "SCY" },            // "SCY" | "SCM" | "LCM" or anything for now
  sections: { type: [SectionSchema], default: [] },
  totals: {
    yardage: { type: Number, default: 0 },
    timeSeconds: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
  roster: { type: String, default: "" },

});

/**
 * Swimmer: keep everything optional/loose while you build UI.
 */
const SwimmerSchema = new mongoose.Schema({
  userId: { type: String, index: true, default: "kyle" },
  firstName: { type: String, default: "" },
  lastName: { type: String, index: true, default: "" },
  dob: { type: String, default: "" },               // YYYY-MM-DD (string for simplicity)
  groups: { type: [String], default: [] },
  bestTimes: { type: mongoose.Schema.Types.Mixed, default: {} },
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

/** Helpful indexes (safe to re-run) */
PracticeSchema.index({ createdAt: -1 });
PracticeSchema.index({ userId: 1 });
SwimmerSchema.index({ userId: 1, lastName: 1, firstName: 1 });

export const Practice = mongoose.model("Practice", PracticeSchema);
export const Swimmer = mongoose.model("Swimmer", SwimmerSchema);
