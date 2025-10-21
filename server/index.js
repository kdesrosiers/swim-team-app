import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectMongo } from "./db.js";
// ⬇️ Alias the export so the name matches what you use below
import { Practice as PracticeModel, User } from "./models.js";
import { hashPassword, comparePassword, generateToken, authMiddleware } from "./auth.js";
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
app.use(cors());
app.use(express.json());

// simple guard (dev)
app.use((req, res, next) => {
  // Skip auth for health check and auth endpoints
  const publicPaths = ["/health", "/api/auth/register", "/api/auth/login"];
  if (publicPaths.includes(req.path)) return next();

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
    const { firstName, lastName, email, phone, username, password, swimTeam } = req.body;

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
      subscription: user.subscription,
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
      subscription: user.subscription,
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
    const userId = req.header("x-user-id") || process.env.DEV_USER_ID || "default-user";
    const where = { userId };
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
    const userId = req.header("x-user-id") || process.env.DEV_USER_ID || "default-user";
    const doc = await PracticeModel.findOne({ _id: req.params.id, userId });
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

// EXPORT DOCX
app.post("/api/export/docx", async (req, res) => {
  try {
    const outDir = process.env.EXPORT_DIR || path.join(process.cwd(), "exports");
    // Expect: { title, date, pool, roster, startTime, sections:[{title,type,text,yardage,timeSeconds}], totals }
    const filePath = await exportPracticeToDocx(req.body, outDir);
    res.json({ ok: true, filePath });
  } catch (e) {
    console.error("Export failed:", e);
    res.status(500).json({ error: "Export failed", detail: String(e?.message || e) });
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

const PORT = process.env.PORT ?? 5174;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
