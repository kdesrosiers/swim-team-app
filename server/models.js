// server/models.js
import mongoose from "mongoose";

/**
 * Mongoose schemas with validation for swim team practices
 *
 * Validation rules:
 * - userId: required, max 100 chars
 * - date: required, YYYY-MM-DD format
 * - roster: required, max 100 chars
 * - pool: enum (SCY, SCM, LCM, or empty), auto-uppercase
 * - title: required, max 300 chars
 * - sections: at least 1 section required
 * - section.type/title: required, max 100/200 chars
 * - section.text: max 10000 chars
 * - section.yardage: 0-100000
 * - section.timeSeconds: 0-86400 (24 hours)
 * - totals.yardage/timeSeconds: min 0
 */

/** A single section in a practice (swim or break) */
const SectionSchema = new mongoose.Schema(
  {
    // For non-breaks, we store the section header in both `type` and `title`
    // (historical compatibility with earlier saves)
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Section type must be less than 100 characters"],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Section title must be less than 200 characters"],
    },
    text: {
      type: String,
      default: "",
      maxlength: [10000, "Section text must be less than 10000 characters"],
    },
    yardage: {
      type: Number,
      default: 0,
      min: [0, "Yardage cannot be negative"],
      max: [100000, "Yardage must be less than 100000"],
    },
    timeSeconds: {
      type: Number,
      default: 0,
      min: [0, "Time cannot be negative"],
      max: [86400, "Time must be less than 24 hours (86400 seconds)"],
    },
  },
  { _id: false }
);

/** A saved practice */
const PracticeSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      maxlength: [100, "User ID must be less than 100 characters"],
    },
    date: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\d{4}-\d{2}-\d{2}$/.test(v);
        },
        message: props => `${props.value} is not a valid date format (YYYY-MM-DD)!`
      },
    },
    roster: {
      type: String,
      required: true,
      index: true,
      trim: true,
      maxlength: [100, "Roster name must be less than 100 characters"],
    },
    pool: {
      type: String,
      enum: {
        values: ["SCY", "SCM", "LCM", ""],
        message: "{VALUE} is not a valid pool type (SCY, SCM, or LCM)"
      },
      default: "SCM",
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [300, "Title must be less than 300 characters"],
    },

    sections: {
      type: [SectionSchema],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length >= 1;
        },
        message: "Practice must have at least one section"
      },
    },
    totals: {
      yardage: {
        type: Number,
        default: 0,
        min: [0, "Total yardage cannot be negative"],
      },
      timeSeconds: {
        type: Number,
        default: 0,
        min: [0, "Total time cannot be negative"],
      },
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
