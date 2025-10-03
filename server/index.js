import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectMongo } from "./db.js";
// ⬇️ Alias the export so the name matches what you use below
import { Practice as PracticeModel } from "./models.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportPracticeToDocx } from "./exportDocx.js";
import { loadConfig, getConfig, saveConfig, watchConfig } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();
app.use(cors());
app.use(express.json());

// simple guard (dev)
app.use((req, res, next) => {
  if (req.path === "/health") return next();   // skip auth for health check
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

// LIST practices by roster/date with paging & optional text search
app.get("/api/practices", async (req, res) => {
  try {
    const { roster = "", q = "", page = 1, limit = 20 } = req.query;
    const userId = req.header("x-user-id") || process.env.DEV_USER_ID || "default-user";
    const where = { userId };
    if (roster) where.roster = roster;
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

const PORT = process.env.PORT ?? 5174;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
