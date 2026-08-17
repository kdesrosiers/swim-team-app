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

/** A single section within a group (for group splits) */
const GroupSectionSchema = new mongoose.Schema(
  {
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

/** A group within a group-split section */
const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Group name must be less than 100 characters"],
    },
    sections: [GroupSectionSchema],
    totalYardage: {
      type: Number,
      default: 0,
    },
    totalTimeSeconds: {
      type: Number,
      default: 0,
    },
    clockTime: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

/** A single section in a practice (swim, break, or group-split) */
const SectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      enum: ["swim", "break", "Break", "group-split"], // Added group-split
      maxlength: [100, "Section type must be less than 100 characters"],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Section title must be less than 200 characters"],
    },
    // Fields for swim/break sections
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
    clockTime: {
      type: String,
      trim: true,
    },
    // Fields for group-split sections
    groups: [GroupSchema],
    longestTimeSeconds: {
      type: Number,
      min: 0,
    },
    pacingGroup: {
      type: String,
      trim: true,
    },
    divergenceSeconds: {
      type: Number,
      min: 0,
    },
    // Sync info (for sections after splits)
    syncInfo: {
      syncedFrom: String,
      groupsWaiting: [String],
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
    season: {
      type: String,
      trim: true,
      maxlength: [100, "Season must be less than 100 characters"],
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
    startTime: {
      type: String,
      trim: true,
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
      // For practices with group splits
      byGroup: {
        type: Map,
        of: new mongoose.Schema({
          yardage: Number,
          timeSeconds: Number,
          actualSwimSeconds: Number,
        }, { _id: false }),
      },
      overallTimeSeconds: {
        type: Number,
        min: 0,
      },
    },
    stats: {
      strokes: {
        type: Map,
        of: Number,
        default: {},
      },
      styles: {
        type: Map,
        of: Number,
        default: {},
      },
    },
    notes: {
      type: String,
      default: "",
      maxlength: [5000, "Notes must be less than 5000 characters"],
    },
    isFavorite: {
      type: Boolean,
      default: false,
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

/**
 * User schema for authentication and account management
 */
const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [100, "First name must be less than 100 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [100, "Last name must be less than 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\d\s\-\+\(\)]+$/, "Please provide a valid phone number"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [50, "Username must be less than 50 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
    },
    subscription: {
      type: {
        type: String,
        enum: ["free", "basic", "premium", "enterprise"],
        default: "free",
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      renewDate: {
        type: Date,
      },
      status: {
        type: String,
        enum: ["active", "expired", "cancelled", "trial"],
        default: "trial",
      },
    },
    paymentHistory: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        currency: { type: String, default: "USD" },
        status: {
          type: String,
          enum: ["success", "failed", "pending", "refunded"],
          required: true,
        },
        transactionId: String,
        description: String,
      },
    ],
    isAdmin: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: [String],
      default: ["read:practices", "write:practices"],
      // Example permissions: "admin", "read:practices", "write:practices", "manage:users"
    },
    billingInfo: {
      creditCard: {
        lastFour: String,
        brand: String, // visa, mastercard, amex, etc.
        expiryMonth: Number,
        expiryYear: Number,
      },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: { type: String, default: "US" },
      },
    },
    swimTeam: {
      name: {
        type: String,
        trim: true,
        maxlength: [200, "Team name must be less than 200 characters"],
      },
      abbreviation: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [10, "Team abbreviation must be less than 10 characters"],
      },
      teamId: {
        type: String,
        trim: true,
      },
    },
    exportDirectory: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Export directory path must be less than 500 characters"],
    },
    lastLogin: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// email and username are already indexed via unique: true above
UserSchema.index({ "subscription.status": 1 });

// Update the updatedAt timestamp before saving
UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export const User = mongoose.model("User", UserSchema);

/**
 * Feedback schema for user testing feedback
 */
const FeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      trim: true,
      maxlength: [100, "User ID must be less than 100 characters"],
    },
    message: {
      type: String,
      required: [true, "Feedback message is required"],
      trim: true,
      maxlength: [5000, "Feedback message must be less than 5000 characters"],
    },
    page: {
      type: String,
      trim: true,
      maxlength: [100, "Page name must be less than 100 characters"],
    },
    status: {
      type: String,
      enum: ["new", "in-progress", "resolved", "dismissed"],
      default: "new",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Status notes must be less than 1000 characters"],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Index for querying feedback by date and status
FeedbackSchema.index({ createdAt: -1 });
FeedbackSchema.index({ status: 1 });

export const Feedback = mongoose.model("Feedback", FeedbackSchema);

/**
 * RosterGroup schema - defines swim level/squad
 */
const RosterGroupSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "User ID must be less than 100 characters"],
    },
    name: {
      type: String,
      required: [true, "Roster group name is required"],
      trim: true,
      maxlength: [100, "Name must be less than 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description must be less than 500 characters"],
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      trim: true,
      maxlength: [7, "Color must be a valid hex code"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

RosterGroupSchema.index({ userId: 1 });

export const RosterGroup = mongoose.model("RosterGroup", RosterGroupSchema);

/**
 * Location schema - primary facility or pool
 */
const LocationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "User ID must be less than 100 characters"],
    },
    name: {
      type: String,
      required: [true, "Location name is required"],
      trim: true,
      maxlength: [100, "Name must be less than 100 characters"],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, "Address must be less than 200 characters"],
    },
    poolType: {
      type: String,
      trim: true,
      enum: ["25Y", "25M", "50M", "Other"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description must be less than 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

LocationSchema.index({ userId: 1 });

export const Location = mongoose.model("Location", LocationSchema);

/**
 * Embedded best time sub-document
 */
const BestTimeSubSchema = new mongoose.Schema(
  {
    event:    { type: String, required: true, trim: true },
    course:   { type: String, enum: ["SCY", "SCM", "LCM"], required: true },
    time:     { type: Number, required: true },   // raw seconds, e.g. 63.45
    meetName: { type: String, trim: true },
    date:     { type: Date },
    isManual: { type: Boolean, default: true },
    isBest:   { type: Boolean, default: false },  // auto-flagged server-side
  },
  { _id: true }
);

/**
 * Swimmer schema — embedded best times, new field names
 */
const SwimmerSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, trim: true },
    firstName:      { type: String, required: true, trim: true },
    lastName:       { type: String, required: true, trim: true },
    dob:            { type: Date, required: true },
    gender:         { type: String, enum: ["Male", "Female", "Non-binary", "Prefer not to say"] },
    graduationYear: { type: Number },
    group:          { type: mongoose.Schema.Types.ObjectId, ref: "RosterGroup" },
    active:         { type: Boolean, default: true },
    usaSwimmingId:  { type: String, trim: true },
    contact: {
      guardianName:  { type: String, trim: true },
      guardianEmail: { type: String, trim: true, lowercase: true },
      phone:         { type: String, trim: true },
      swimmerEmail:  { type: String, trim: true, lowercase: true },
    },
    notes:     { type: String, trim: true, maxlength: [2000, "Notes must be less than 2000 characters"] },
    bestTimes: [BestTimeSubSchema],
  },
  { timestamps: true, versionKey: false }
);

SwimmerSchema.index({ userId: 1, lastName: 1, firstName: 1 });
SwimmerSchema.index({ userId: 1, group: 1 });
SwimmerSchema.index({ userId: 1, active: 1 });

export const Swimmer = mongoose.model("Swimmer", SwimmerSchema);

// Legacy BestTime collection — kept for migration script access only
const BestTimeSchema = new mongoose.Schema(
  {
    swimmer:       { type: mongoose.Schema.Types.ObjectId, ref: "Swimmer", index: true },
    event:         { type: String, trim: true },
    stroke:        { type: String },
    distance:      { type: Number },
    course:        { type: String, enum: ["SCY", "SCM", "LCM"] },
    time:          { type: Number },
    timeFormatted: { type: String },
    meetName:      { type: String },
    meetDate:      { type: Date },
    ageAtMeet:     { type: Number },
    timeStandard:  { type: String },
  },
  { versionKey: false, strict: false }
);

export const BestTime = mongoose.model("BestTime", BestTimeSchema);

/**
 * Time Standards schema – stores cut time tables (event × age group × standard level)
 */
/**
 * One row in the cut table: event + ageGroup.
 * cuts is a flat Map keyed as "gender:course:level", e.g. "F:SCY:AA" -> "1:23.45"
 */
const CutEntrySchema = new mongoose.Schema(
  {
    event:    { type: String, required: true, trim: true, maxlength: 100 },
    ageGroup: { type: String, required: true, trim: true, maxlength: 50 },
    cuts:     { type: Map, of: String },
  },
  { _id: false }
);

const TimeStandardsSetSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      maxlength: 100,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [200, "Name must be less than 200 characters"],
    },
    organization: { type: String, trim: true, default: "" },
    standardLevels: { type: [String], default: ["AAAA", "AAA", "AA", "A", "BB", "B"] },
    events: { type: [String], default: [] },
    entries: { type: [CutEntrySchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

TimeStandardsSetSchema.index({ userId: 1, name: 1 });

TimeStandardsSetSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export const TimeStandardsSet = mongoose.model("TimeStandardsSet", TimeStandardsSetSchema);
