// server/config.js
// ESM-safe config loader with validation, caching, and file watching

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default: <repo>/server/config/roster.config.json
const DEFAULT_CONFIG_PATH = path.join(__dirname, "config", "roster.config.json");

// Allow overriding via env (absolute or relative to CWD)
const CONFIG_PATH = process.env.CONFIG_PATH
    ? path.isAbsolute(process.env.CONFIG_PATH)
        ? process.env.CONFIG_PATH
        : path.resolve(process.env.CONFIG_PATH)
    : DEFAULT_CONFIG_PATH;

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let cache = null;

/* ---------------------------- Validation ---------------------------- */

function isHHMM(str) {
    return typeof str === "string" && /^\d{1,2}:\d{2}$/.test(str);
}

function validateConfig(cfg) {
    const errors = [];

    // rosters: array of strings
    if (!Array.isArray(cfg?.rosters)) {
        errors.push("`rosters` must be an array of strings");
    } else if (!cfg.rosters.every((r) => typeof r === "string" && r.trim().length > 0)) {
        errors.push("every roster in `rosters` must be a non-empty string");
    }

    // ✅ NEW: defaultRoster must be a member of rosters if provided
    if (cfg.defaultRoster != null) {
        if (typeof cfg.defaultRoster !== "string") {
            errors.push("`defaultRoster` must be a string");
        } else if (Array.isArray(cfg.rosters) && !cfg.rosters.includes(cfg.defaultRoster)) {
            errors.push("`defaultRoster` must be one of `rosters`");
        }
    }
    // warmups: object<string, string>
    if (cfg?.warmups == null || typeof cfg.warmups !== "object") {
        errors.push("`warmups` must be an object mapping roster -> warmup text");
    }

    // practiceSchedule: { [roster: string]: { Mon..Sun: "HH:MM" | "OFF" } }
    if (cfg?.practiceSchedule == null || typeof cfg.practiceSchedule !== "object") {
        errors.push("`practiceSchedule` must be an object mapping roster -> weekly schedule");
    } else {
        for (const [roster, week] of Object.entries(cfg.practiceSchedule)) {
            if (typeof week !== "object" || week == null) {
                errors.push(`practiceSchedule['${roster}'] must be an object`);
                continue;
            }
            for (const day of DAY_KEYS) {
                const v = week[day];
                if (v == null) {
                    // allow missing; treat as OFF
                    continue;
                }
                if (v !== "OFF" && !isHHMM(v)) {
                    errors.push(
                        `practiceSchedule['${roster}']['${day}'] must be 'OFF' or HH:MM (24h), got: ${JSON.stringify(v)}`
                    );
                }
            }
        }
    }

    if (errors.length) {
        const err = new Error("Invalid config: " + errors.join("; "));
        err.status = 400;
        throw err;
    }
}

/* ---------------------------- I/O Helpers --------------------------- */

async function ensureDirExists(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function writeJsonAtomic(filePath, data) {
    await ensureDirExists(filePath);
    const tmp = filePath + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, filePath);
}

/* --------------------------- Public API ----------------------------- */

export function getConfigPath() {
    return CONFIG_PATH;
}

export async function loadConfig() {
    // Throws if missing; create a helpful message
    try {
        const cfg = await readJson(CONFIG_PATH);
        validateConfig(cfg);
        cache = cfg;
        return cache;
    } catch (e) {
        if (e.code === "ENOENT") {
            const msg = `Config file not found at ${CONFIG_PATH}.
Create it (example at server/config/roster.config.json) or set CONFIG_PATH env.`;
            const err = new Error(msg);
            err.cause = e;
            throw err;
        }
        throw e;
    }
}

export function getConfig() {
    return cache; // may be null until loadConfig() is called
}

export async function saveConfig(newCfg) {
    validateConfig(newCfg);
    await writeJsonAtomic(CONFIG_PATH, newCfg);
    cache = newCfg;
    return cache;
}

// Optional hot-reload on file changes (best-effort, debounced)
export function watchConfig() {
    // fs.watch can be noisy on Windows—debounce reloads
    let timer = null;
    try {
        // Create a watcher only if the file exists; otherwise fs.watch throws
        if (!fsSync.existsSync(CONFIG_PATH)) {
            console.warn(`[config] watch skipped (file does not exist yet): ${CONFIG_PATH}`);
            return;
        }
        fsSync.watch(CONFIG_PATH, { persistent: false }, () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                try {
                    await loadConfig();
                    console.log("[config] reloaded");
                } catch (e) {
                    console.error("[config] reload failed:", e.message);
                }
            }, 150);
        });
    } catch (e) {
        console.warn("[config] watch not available:", e.message);
    }
}
