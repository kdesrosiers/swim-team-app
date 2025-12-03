import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectMongo } from "./db.js";
// ⬇️ Alias the export so the name matches what you use below
import { Practice as PracticeModel, User, Feedback, Swimmer, RosterGroup, Location, BestTime } from "./models.js";
import { hashPassword, comparePassword, generateToken, authMiddleware, requireAdmin } from "./auth.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportPracticeToDocx } from "./exportDocx.js";
import { loadConfig, getConfig, saveConfig, watchConfig } from "./config.js";
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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-user-id']
}));

app.use(express.json());

// simple guard (dev)
app.use((req, res, next) => {
  // Skip auth for health check and auth endpoints
  const publicPaths = ["/health", "/api/auth/register", "/api/auth/login"];
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
    if (roster) where.roster = roster;
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
    const { userId, ...practiceData } = req.body;

    // Try to get user's export directory if userId is provided
    let outDir = "C:\\Users\\kdesr\\Desktop\\Practices"; // default

    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user && user.exportDirectory) {
          outDir = user.exportDirectory;
        }
      } catch (error) {
        console.warn("Could not fetch user export directory:", error.message);
      }
    }

    // Fallback to environment variable if set
    outDir = process.env.EXPORT_DIR || outDir;

    // Expect: { title, date, pool, roster, startTime, sections:[{title,type,text,yardage,timeSeconds}], totals }
    const filePath = await exportPracticeToDocx(practiceData, outDir);
    res.json({ ok: true, filePath });
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

// GET all swimmers with filtering
app.get("/api/swimmers", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rosterGroup, location, memberStatus, search, sortBy, sortOrder } = req.query;

    let query = { userId };

    if (rosterGroup) query.rosterGroup = rosterGroup;
    if (location) query.location = location;
    if (memberStatus) query.memberStatus = memberStatus;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { preferredName: searchRegex },
      ];
    }

    let swimmers = await Swimmer.find(query)
      .populate("rosterGroup")
      .populate("location");

    // Sort
    const sortField = sortBy || "lastName";
    const order = sortOrder === "desc" ? -1 : 1;
    swimmers.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });

    res.json(swimmers);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch swimmers" });
  }
});

// GET single swimmer
app.get("/api/swimmers/:id", authMiddleware, async (req, res) => {
  try {
    const swimmer = await Swimmer.findById(req.params.id)
      .populate("rosterGroup")
      .populate("location");

    if (!swimmer) {
      return res.status(404).json({ error: "Swimmer not found" });
    }

    if (swimmer.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    res.json(swimmer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch swimmer" });
  }
});

// CREATE swimmer
app.post("/api/swimmers", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      firstName,
      lastName,
      middleName,
      preferredName,
      dateOfBirth,
      gender,
      usaSwimmingId,
      customSwimmerId,
      rosterGroup,
      location,
      memberStatus,
      email,
      phone,
      emergencyContact,
      medicalNotes,
      insurance,
      racingStartCertified,
      swimsuitSize,
      joinDate,
      notes,
    } = req.body;

    // Validation
    if (!firstName || !lastName || !dateOfBirth || !gender || !rosterGroup) {
      return res.status(400).json({
        error: "First name, last name, date of birth, gender, and roster group are required",
      });
    }

    const swimmer = new Swimmer({
      userId,
      firstName,
      lastName,
      middleName: middleName || undefined,
      preferredName: preferredName || undefined,
      dateOfBirth,
      gender,
      usaSwimmingId: usaSwimmingId || undefined,
      customSwimmerId: customSwimmerId || undefined,
      rosterGroup,
      location: location || undefined,
      memberStatus: memberStatus || "Active",
      email: email || undefined,
      phone: phone || undefined,
      emergencyContact: emergencyContact || undefined,
      medicalNotes: medicalNotes || undefined,
      insurance: insurance || undefined,
      racingStartCertified: racingStartCertified || false,
      swimsuitSize: swimsuitSize || undefined,
      joinDate: joinDate || undefined,
      notes: notes || undefined,
    });

    await swimmer.save();
    await swimmer.populate("rosterGroup location");
    res.status(201).json(swimmer);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to create swimmer" });
  }
});

// UPDATE swimmer
app.put("/api/swimmers/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const swimmer = await Swimmer.findById(req.params.id);

    if (!swimmer) {
      return res.status(404).json({ error: "Swimmer not found" });
    }

    if (swimmer.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Update all fields
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== "userId" && key !== "_id" && key !== "createdAt") {
        swimmer[key] = updates[key];
      }
    });

    await swimmer.save();
    await swimmer.populate("rosterGroup location");
    res.json(swimmer);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to update swimmer" });
  }
});

// DELETE swimmer (soft delete by setting to inactive)
app.delete("/api/swimmers/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const swimmer = await Swimmer.findById(req.params.id);

    if (!swimmer) {
      return res.status(404).json({ error: "Swimmer not found" });
    }

    if (swimmer.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Soft delete
    swimmer.memberStatus = "Inactive";
    swimmer.inactiveDate = new Date();
    await swimmer.save();

    res.json({ message: "Swimmer deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete swimmer" });
  }
});

// ========== BEST TIME ENDPOINTS ==========

// GET best times for a swimmer
app.get("/api/swimmers/:swimmerId/best-times", authMiddleware, async (req, res) => {
  try {
    const swimmerId = req.params.swimmerId;

    // Verify ownership
    const swimmer = await Swimmer.findById(swimmerId);
    if (!swimmer) {
      return res.status(404).json({ error: "Swimmer not found" });
    }

    if (swimmer.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const bestTimes = await BestTime.find({ swimmer: swimmerId }).sort({
      stroke: 1,
      distance: 1,
      course: 1,
    });

    res.json(bestTimes);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch best times" });
  }
});

// CREATE best time
app.post("/api/swimmers/:swimmerId/best-times", authMiddleware, async (req, res) => {
  try {
    const swimmerId = req.params.swimmerId;
    const { event, stroke, distance, course, time, meetName, meetDate, timeStandard } = req.body;

    // Verify ownership
    const swimmer = await Swimmer.findById(swimmerId);
    if (!swimmer) {
      return res.status(404).json({ error: "Swimmer not found" });
    }

    if (swimmer.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Validation
    if (!event || !stroke || !distance || !course || !time || !meetDate) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Calculate age at meet
    const meetDateObj = new Date(meetDate);
    const dob = new Date(swimmer.dateOfBirth);
    let ageAtMeet = meetDateObj.getFullYear() - dob.getFullYear();
    const monthDiff = meetDateObj.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && meetDateObj.getDate() < dob.getDate())) {
      ageAtMeet--;
    }

    // Format time
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(2);
    const timeFormatted = `${minutes}:${seconds.padStart(5, "0")}`;

    const bestTime = new BestTime({
      swimmer: swimmerId,
      event,
      stroke,
      distance,
      course,
      time,
      timeFormatted,
      meetName: meetName || undefined,
      meetDate: meetDateObj,
      ageAtMeet,
      timeStandard: timeStandard || undefined,
    });

    await bestTime.save();
    res.status(201).json(bestTime);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to create best time" });
  }
});

// UPDATE best time
app.put("/api/best-times/:id", authMiddleware, async (req, res) => {
  try {
    const bestTime = await BestTime.findById(req.params.id).populate("swimmer");

    if (!bestTime) {
      return res.status(404).json({ error: "Best time not found" });
    }

    if (bestTime.swimmer.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { event, stroke, distance, course, time, meetName, meetDate, timeStandard } = req.body;

    if (event) bestTime.event = event;
    if (stroke) bestTime.stroke = stroke;
    if (distance) bestTime.distance = distance;
    if (course) bestTime.course = course;
    if (time) {
      bestTime.time = time;
      const minutes = Math.floor(time / 60);
      const seconds = (time % 60).toFixed(2);
      bestTime.timeFormatted = `${minutes}:${seconds.padStart(5, "0")}`;
    }
    if (meetName !== undefined) bestTime.meetName = meetName;
    if (meetDate) bestTime.meetDate = new Date(meetDate);
    if (timeStandard !== undefined) bestTime.timeStandard = timeStandard;

    await bestTime.save();
    res.json(bestTime);
  } catch (e) {
    console.error(e);
    if (e.name === "ValidationError") {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    res.status(500).json({ error: "Failed to update best time" });
  }
});

// DELETE best time
app.delete("/api/best-times/:id", authMiddleware, async (req, res) => {
  try {
    const bestTime = await BestTime.findById(req.params.id).populate("swimmer");

    if (!bestTime) {
      return res.status(404).json({ error: "Best time not found" });
    }

    if (bestTime.swimmer.userId !== req.user.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await BestTime.deleteOne({ _id: req.params.id });
    res.json({ message: "Best time deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete best time" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
