import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectMongo } from "./db.js";
import { Practice } from "./models.js";
import path from "node:path";
import { exportPracticeToDocx } from "./exportDocx.js";

dotenv.config();
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

// List practices (optionally filter by user)
app.get("/api/practices", async (req, res) => {
  const userId = req.header("x-user-id") || "kyle";
  const { q } = req.query;
  const filter = { userId };
  if (q) filter.$text = { $search: q };
  const items = await Practice.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json(items);
});

// Create a practice
app.post("/api/practices", async (req, res) => {
  const userId = req.header("x-user-id") || "kyle";
  const created = await Practice.create({ ...req.body, userId });
  res.status(201).json(created);
});

app.post("/api/export/docx", async (req, res) => {
  try {
    const outDir = process.env.EXPORT_DIR || path.join(process.cwd(), "exports");
    // Expect same shape we save: { title, date, pool, roster, sections: [{title,type,text,yardage,timeSeconds}], totals }
    const filePath = await exportPracticeToDocx(req.body, outDir);
    res.json({ ok: true, filePath });
  } catch (e) {
    console.error("Export failed:", e);
    res.status(500).json({ error: "Export failed", detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT ?? 5174;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));

