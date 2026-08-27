import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectMongo } from "./db.js";
// ⬇️ Alias the export so the name matches what you use below
import { Practice as PracticeModel, User, Feedback, Swimmer, RosterGroup, Location, BestTime, TimeStandardsSet } from "./models.js";

// ── Swimmer helper ────────────────────────────────────────────────────────────
/** After any mutation to swimmer.bestTimes, re-flag isBest per event+course. */
function flagBestTimes(swimmer) {
  const groups = {};
  swimmer.bestTimes.forEach((t, i) => {
    const key = `${t.event}||${t.course}`;
    if (!groups[key] || t.time < groups[key].time) {
      groups[key] = { time: t.time, idx: i };
    }
  });
  swimmer.bestTimes.forEach((t, i) => {
    const key = `${t.event}||${t.course}`;
    t.isBest = groups[key]?.idx === i;
  });
}
import { hashPassword, comparePassword, generateToken, authMiddleware, requireAdmin } from "./auth.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportPracticeToDocx } from "./exportDocx.js";
import { loadConfig, getConfig, saveConfig, watchConfig } from "./config.js";
import { convertTime as _convertTime, parseTime as _parseTime } from "./utils/swimTimeConversion.js";
import { loadSeasonsConfig, getSeasonsConfig, saveSeasonsConfig, watchSeasonsConfig } from "./seasonsConfig.js";
import { loadAcronymsConfig, getAcronymsConfig, saveAcronymsConfig, watchAcronymsConfig } from "./acronymsConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();

// CORS configuration for multiple environments
const allowedOrigins = [
  'http://localhost:3000', // Local development
  process.env.FRONTEND_URL // Production Vercel URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-user-id'],
  exposedHeaders: ['Content-Disposition']
}));

app.use(express.json());

// simple guard (dev)
app.use((req, res, next) => {
  // Skip auth for health check, auth endpoints, and public config data
  const publicPaths = ["/health", "/api/auth/register", "/api/auth/login", "/api/config", "/api/seasons", "/api/acronyms"];
  if (publicPaths.includes(req.path)) return next();

  // Allow PUT /api/users/* for user profile updates
  if (req.method === "PUT" && req.path.startsWith("/api/users/")) return next();

  // Check for JWT token (preferred for authenticated users)
  const authHeader = req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    // JWT token is present, try to verify it
    try {
      authMiddleware(req, res, next);
      return;
    } catch (e) {
      // If JWT verification fails, fall through to check admin key
    }
  }

  // Fall back to admin key for dev/admin operations
  const key = req.header("x-admin-key");
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

await connectMongo();
await loadConfig();
watchConfig();
await loadSeasonsConfig();
watchSeasonsConfig();
await loadAcronymsConfig();
watchAcronymsConfig();

// ========== AUTH ENDPOINTS ==========

// REGISTER a new user
app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, username, password, swimTeam, exportDirectory } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !username || !password) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Email already registered" });
      }
      return res.status(400).json({ error: "Username already taken" });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      username,
      password: hashedPassword,
      swimTeam: swimTeam || {},
      exportDirectory: exportDirectory || "",
      subscription: {
        type: "free",
        status: "trial",
        startDate: new Date(),
        renewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      },
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    // Return user without password
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      swimTeam: user.swimTeam,
      exportDirectory: user.exportDirectory,
      subscription: user.subscription,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
    };

    res.status(201).json({ user: userResponse, token });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed", detail: error.message });
  }
});

// LOGIN user
app.post("/api/auth/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    // Return user without password
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      swimTeam: user.swimTeam,
      exportDirectory: user.exportDirectory,
      subscription: user.subscription,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
      lastLogin: user.lastLogin,
    };

    res.json({ user: userResponse, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed", detail: error.message });
  }
});

// GET current user profile (protected)
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user", detail: error.message });
  }
});

// ========== PRACTICES ENDPOINTS ==========

// LIST practices by roster/date with paging & optional text search
app.get("/api/practices", async (req, res) => {
  try {
    const { roster = "", season = "", q = "", page = 1, limit = 20 } = req.query;
    const where = {};
    if (roster) {
      const r = roster.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      where.roster = { $regex: `(^|\\/)${r}(\\/|$)`, $options: "i" };
    }
    if (season) where.season = season;
    if (q) {
      where.$or = [
        { title: { $regex: q, $options: "i" } },
        { "sections.text": { $regex: q, $options: "i" } },
      ];
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const [items, total] = await Promise.all([
      PracticeModel.find(where)
        .sort({ date: -1 }) // newest first
        .skip((p - 1) * lim)
        .limit(lim)
        .lean(),
      PracticeModel.countDocuments(where),
    ]);

    res.json({ items, total, page: p, limit: lim });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list practices" });
  }
});

// READ one
app.get("/api/practices/:id", async (req, res) => {
  try {
    const doc = await PracticeModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch practice" });
  }
});

// CREATE
app.post("/api/practices", async (req, res) => {
  try {
    const userId = req.header("x-user-id") || process.env.DEV_USER_ID || "default-user";
    const created = await PracticeModel.create({ ...req.body, userId });
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    // Handle Mongoose validation errors
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to create practice" });
  }
});

// UPDATE practice (including notes)
app.put("/api/practices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await PracticeModel.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Practice not found" });
    }
    res.json(updated);
  } catch (e) {
    console.error(e);
    // Handle Mongoose validation errors
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to update practice" });
  }
});

// TOGGLE favorite for a practice
app.put("/api/practices/:id/favorite", async (req, res) => {
  try {
    const { id } = req.params;
    const practice = await PracticeModel.findById(id);

    if (!practice) {
      return res.status(404).json({ error: "Practice not found" });
    }

    // Toggle favorite status
    practice.isFavorite = !practice.isFavorite;
    await practice.save();

    res.json({ isFavorite: practice.isFavorite });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

// EXPORT DOCX
app.post("/api/export/docx", async (req, res) => {
  try {
    const { buffer, filename } = await exportPracticeToDocx(req.body);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    console.error("Export failed:", e);
    res.status(500).json({ error: "Export failed", detail: String(e?.message || e) });
  }
});

// UPDATE USER PROFILE
app.put("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { exportDirectory } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { exportDirectory },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return updated user data
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      swimTeam: user.swimTeam,
      exportDirectory: user.exportDirectory,
      subscription: user.subscription,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
    };

    res.json(userResponse);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user", detail: String(error?.message || error) });
  }
});

// CONFIG
app.get("/api/config", (req, res) => res.json(getConfig() || {}));
app.put("/api/config", async (req, res) => {
  try {
    const updated = await saveConfig(req.body || {});
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Failed to save config", detail: String(e?.message || e) });
  }
});

// SEASONS CONFIG
app.get("/api/seasons", (req, res) => res.json(getSeasonsConfig() || { seasons: [] }));
app.put("/api/seasons", async (req, res) => {
  try {
    const updated = await saveSeasonsConfig(req.body || { seasons: [] });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Failed to save seasons config", detail: String(e?.message || e) });
  }
});

// ACRONYMS CONFIG
app.get("/api/acronyms", (req, res) => res.json(getAcronymsConfig() || { strokes: {}, styles: {} }));
app.put("/api/acronyms", async (req, res) => {
  try {
    const updated = await saveAcronymsConfig(req.body || { strokes: {}, styles: {} });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Failed to save acronyms config", detail: String(e?.message || e) });
  }
});

// FEEDBACK
app.post("/api/feedback", async (req, res) => {
  try {
    const userId = req.header("x-user-id") || process.env.DEV_USER_ID || "anonymous";
    const { message, page } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Feedback message is required" });
    }

    const feedback = await Feedback.create({
      userId,
      message,
      page: page || "unknown",
    });

    res.status(201).json(feedback);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

// GET all feedback with optional filtering (admin only)
app.get("/api/feedback", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, sort = "-createdAt" } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const feedbacks = await Feedback.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Feedback.countDocuments(filter);

    res.json({
      items: feedbacks,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// GET single feedback by ID (admin only)
app.get("/api/feedback/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json(feedback);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// UPDATE feedback status and notes (admin only)
app.put("/api/feedback/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { updatedAt: new Date() };

    if (status) {
      update.status = status;
    }
    if (notes !== undefined) {
      update.notes = notes;
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json(feedback);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

// ========== ROSTER GROUP ENDPOINTS ==========

// GET all roster groups
app.get("/api/roster-groups", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const groups = await RosterGroup.find({ userId }).sort({ displayOrder: 1, name: 1 });
    res.json(groups);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch roster groups" });
  }
});

// CREATE roster group
app.post("/api/roster-groups", authMiddleware, async (req, res) => {
  try {
    const { name, description, displayOrder, color } = req.body;
    const userId = req.user.userId;

    if (!name) {
      return res.status(400).json({ error: "Roster group name is required" });
    }

    const group = new RosterGroup({
      userId,
      name,
      description: description || undefined,
      displayOrder: displayOrder || 0,
      color: color || undefined,
    });

    await group.save();
    res.status(201).json(group);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to create roster group" });
  }
});

// UPDATE roster group
app.put("/api/roster-groups/:id", authMiddleware, async (req, res) => {
  try {
    const { name, description, displayOrder, color, isActive } = req.body;
    const userId = req.user.userId;

    const group = await RosterGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: "Roster group not found" });
    }

    if (group.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (displayOrder !== undefined) group.displayOrder = displayOrder;
    if (color !== undefined) group.color = color;
    if (isActive !== undefined) group.isActive = isActive;

    await group.save();
    res.json(group);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to update roster group" });
  }
});

// DELETE roster group
app.delete("/api/roster-groups/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const group = await RosterGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: "Roster group not found" });
    }

    if (group.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await RosterGroup.deleteOne({ _id: req.params.id });
    res.json({ message: "Roster group deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete roster group" });
  }
});

// ========== LOCATION ENDPOINTS ==========

// GET all locations
app.get("/api/locations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const locations = await Location.find({ userId }).sort({ name: 1 });
    res.json(locations);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// CREATE location
app.post("/api/locations", authMiddleware, async (req, res) => {
  try {
    const { name, address, poolType, description } = req.body;
    const userId = req.user.userId;

    if (!name) {
      return res.status(400).json({ error: "Location name is required" });
    }

    const location = new Location({
      userId,
      name,
      address: address || undefined,
      poolType: poolType || undefined,
      description: description || undefined,
    });

    await location.save();
    res.status(201).json(location);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to create location" });
  }
});

// UPDATE location
app.put("/api/locations/:id", authMiddleware, async (req, res) => {
  try {
    const { name, address, poolType, description, isActive } = req.body;
    const userId = req.user.userId;

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    if (location.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (name) location.name = name;
    if (address !== undefined) location.address = address;
    if (poolType !== undefined) location.poolType = poolType;
    if (description !== undefined) location.description = description;
    if (isActive !== undefined) location.isActive = isActive;

    await location.save();
    res.json(location);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to update location" });
  }
});

// DELETE location
app.delete("/api/locations/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    if (location.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await Location.deleteOne({ _id: req.params.id });
    res.json({ message: "Location deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete location" });
  }
});

// ========== SWIMMER ENDPOINTS ==========

// GET all swimmers
app.get("/api/swimmers", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { group, active, search } = req.query;

    const query = { userId };
    if (group) query.group = group;
    if (active !== undefined) query.active = active === "true";

    if (search) {
      const re = new RegExp(search, "i");
      query.$or = [{ firstName: re }, { lastName: re }];
    }

    const swimmers = await Swimmer.find(query)
      .populate("group", "name color")
      .sort({ lastName: 1, firstName: 1 });

    res.json(swimmers);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch swimmers" });
  }
});

// GET single swimmer (full doc with embedded bestTimes)
app.get("/api/swimmers/:id", authMiddleware, async (req, res) => {
  try {
    const swimmer = await Swimmer.findById(req.params.id).populate("group", "name color");

    if (!swimmer) return res.status(404).json({ error: "Swimmer not found" });
    if (swimmer.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });

    res.json(swimmer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch swimmer" });
  }
});

// CREATE swimmer
app.post("/api/swimmers", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, dob, gender, graduationYear, group, usaSwimmingId, contact, notes } = req.body;

    if (!firstName || !lastName || !dob) {
      return res.status(400).json({ error: "firstName, lastName, and dob are required" });
    }

    const swimmer = new Swimmer({
      userId: req.user.userId,
      firstName, lastName, dob, gender,
      graduationYear: graduationYear || undefined,
      group: group || undefined,
      usaSwimmingId: usaSwimmingId || undefined,
      contact: contact || undefined,
      notes: notes || undefined,
    });

    await swimmer.save();
    await swimmer.populate("group", "name color");
    res.status(201).json(swimmer);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: Object.values(e.errors).map(err => err.message) });
    }
    res.status(500).json({ error: "Failed to create swimmer" });
  }
});

// UPDATE swimmer info / contact / notes (NOT bestTimes)
app.put("/api/swimmers/:id", authMiddleware, async (req, res) => {
  try {
    const swimmer = await Swimmer.findById(req.params.id);
    if (!swimmer) return res.status(404).json({ error: "Swimmer not found" });
    if (swimmer.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });

    const allowed = ["firstName", "lastName", "dob", "gender", "graduationYear", "group", "active", "usaSwimmingId", "contact", "notes"];
    allowed.forEach(key => {
      if (key in req.body) swimmer[key] = req.body[key];
    });

    await swimmer.save();
    await swimmer.populate("group", "name color");
    res.json(swimmer);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: Object.values(e.errors).map(err => err.message) });
    }
    res.status(500).json({ error: "Failed to update swimmer" });
  }
});

// DELETE swimmer (soft delete)
app.delete("/api/swimmers/:id", authMiddleware, async (req, res) => {
  try {
    const swimmer = await Swimmer.findById(req.params.id);
    if (!swimmer) return res.status(404).json({ error: "Swimmer not found" });
    if (swimmer.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });

    swimmer.active = false;
    await swimmer.save();
    res.json({ message: "Swimmer deactivated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete swimmer" });
  }
});

// ========== EMBEDDED BEST TIME ENDPOINTS ==========

// POST /api/swimmers/:id/times — add a time entry
app.post("/api/swimmers/:id/times", authMiddleware, async (req, res) => {
  try {
    const swimmer = await Swimmer.findById(req.params.id);
    if (!swimmer) return res.status(404).json({ error: "Swimmer not found" });
    if (swimmer.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });

    const { event, course, time, meetName, date } = req.body;
    if (!event || !course || time == null) {
      return res.status(400).json({ error: "event, course, and time are required" });
    }

    swimmer.bestTimes.push({ event, course, time, meetName, date, isManual: true });
    flagBestTimes(swimmer);
    await swimmer.save();
    await swimmer.populate("group", "name color");
    res.status(201).json(swimmer);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: Object.values(e.errors).map(err => err.message) });
    }
    res.status(500).json({ error: "Failed to add time" });
  }
});

// PUT /api/swimmers/:id/times/:timeId — edit a time entry
app.put("/api/swimmers/:id/times/:timeId", authMiddleware, async (req, res) => {
  try {
    const swimmer = await Swimmer.findById(req.params.id);
    if (!swimmer) return res.status(404).json({ error: "Swimmer not found" });
    if (swimmer.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });

    const entry = swimmer.bestTimes.id(req.params.timeId);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });

    const { event, course, time, meetName, date } = req.body;
    if (event !== undefined) entry.event = event;
    if (course !== undefined) entry.course = course;
    if (time !== undefined) entry.time = time;
    if (meetName !== undefined) entry.meetName = meetName;
    if (date !== undefined) entry.date = date;

    flagBestTimes(swimmer);
    await swimmer.save();
    await swimmer.populate("group", "name color");
    res.json(swimmer);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: Object.values(e.errors).map(err => err.message) });
    }
    res.status(500).json({ error: "Failed to update time" });
  }
});

// DELETE /api/swimmers/:id/times/:timeId — delete a time entry
app.delete("/api/swimmers/:id/times/:timeId", authMiddleware, async (req, res) => {
  try {
    const swimmer = await Swimmer.findById(req.params.id);
    if (!swimmer) return res.status(404).json({ error: "Swimmer not found" });
    if (swimmer.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });

    const entry = swimmer.bestTimes.id(req.params.timeId);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });

    entry.deleteOne();
    flagBestTimes(swimmer);
    await swimmer.save();
    await swimmer.populate("group", "name color");
    res.json(swimmer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete time" });
  }
});

// ── Time Conversion ──────────────────────────────────────────────────────────

app.post("/api/times/convert", async (req, res) => {
  try {
    const { time, fromCourse, toCourse, stroke, distance } = req.body;
    if (!time || !fromCourse || !toCourse || !stroke || !distance) {
      return res.status(400).json({ error: "time, fromCourse, toCourse, stroke, and distance are required" });
    }
    const result = _convertTime(time, fromCourse, toCourse, stroke, distance);
    res.json({
      originalTime: time,
      convertedTime: result.convertedTime,
      factor: result.factor,
      method: result.method,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Time Standards ───────────────────────────────────────────────────────────

app.get("/api/time-standards", authMiddleware, async (req, res) => {
  try {
    const sets = await TimeStandardsSet.find({ userId: req.user.userId }).sort({ name: 1 });
    res.json(sets);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch time standards" });
  }
});

app.post("/api/time-standards", authMiddleware, async (req, res) => {
  try {
    const { name, organization, standardLevels, events, entries } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    const set = new TimeStandardsSet({
      userId: req.user.userId,
      name,
      organization: organization || "",
      standardLevels: standardLevels || ["AAAA", "AAA", "AA", "A", "BB", "B"],
      events: events || [],
      entries: entries || [],
    });
    await set.save();
    res.status(201).json(set);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const details = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details });
    }
    res.status(500).json({ error: "Failed to create time standards set" });
  }
});

app.put("/api/time-standards/:id", authMiddleware, async (req, res) => {
  try {
    const set = await TimeStandardsSet.findById(req.params.id);
    if (!set) return res.status(404).json({ error: "Time standards set not found" });
    if (set.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });

    const { name, organization, standardLevels, events, entries } = req.body;
    if (name !== undefined) set.name = name;
    if (organization !== undefined) set.organization = organization;
    if (standardLevels !== undefined) set.standardLevels = standardLevels;
    if (events !== undefined) set.events = events;
    if (entries !== undefined) set.entries = entries;

    await set.save();
    res.json(set);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const details = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details });
    }
    res.status(500).json({ error: "Failed to update time standards set" });
  }
});

app.delete("/api/time-standards/:id", authMiddleware, async (req, res) => {
  try {
    const set = await TimeStandardsSet.findById(req.params.id);
    if (!set) return res.status(404).json({ error: "Time standards set not found" });
    if (set.userId !== req.user.userId) return res.status(403).json({ error: "Not authorized" });
    await TimeStandardsSet.deleteOne({ _id: req.params.id });
    res.json({ message: "Deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete time standards set" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
