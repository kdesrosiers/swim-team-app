// server/seasonsConfig.js
// Season config loader with validation, caching, and file watching

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default: <repo>/server/config/seasons.config.json
const DEFAULT_SEASONS_PATH = path.join(__dirname, "config", "seasons.config.json");

// Allow overriding via env (absolute or relative to CWD)
const SEASONS_PATH = process.env.SEASONS_CONFIG_PATH
    ? path.isAbsolute(process.env.SEASONS_CONFIG_PATH)
        ? process.env.SEASONS_CONFIG_PATH
        : path.resolve(process.env.SEASONS_CONFIG_PATH)
    : DEFAULT_SEASONS_PATH;

let cache = null;

/* ---------------------------- Validation ---------------------------- */

function isValidDate(str) {
    return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function validateSeasonsConfig(cfg) {
    const errors = [];

    // seasons: array of season objects
    if (!Array.isArray(cfg?.seasons)) {
        errors.push("`seasons` must be an array of season objects");
    } else {
        cfg.seasons.forEach((season, idx) => {
            if (typeof season !== "object" || season == null) {
                errors.push(`season[${idx}] must be an object`);
                return;
            }

            // id: unique identifier (optional but recommended)
            if (season.id != null && typeof season.id !== "string") {
                errors.push(`season[${idx}].id must be a string`);
            }

            // title: required string
            if (typeof season.title !== "string" || !season.title.trim()) {
                errors.push(`season[${idx}].title must be a non-empty string`);
            }

            // startDate: required YYYY-MM-DD
            if (!isValidDate(season.startDate)) {
                errors.push(`season[${idx}].startDate must be in YYYY-MM-DD format`);
            }

            // endDate: required YYYY-MM-DD
            if (!isValidDate(season.endDate)) {
                errors.push(`season[${idx}].endDate must be in YYYY-MM-DD format`);
            }

            // endDate should be after startDate
            if (isValidDate(season.startDate) && isValidDate(season.endDate)) {
                if (new Date(season.endDate) < new Date(season.startDate)) {
                    errors.push(`season[${idx}].endDate must be after startDate`);
                }
            }

            // Check for duplicate IDs if id is provided
            if (season.id != null) {
                const duplicates = cfg.seasons.filter(s => s.id === season.id);
                if (duplicates.length > 1) {
                    errors.push(`season[${idx}].id "${season.id}" is duplicated`);
                }
            }
        });
    }

    if (errors.length) {
        const err = new Error("Invalid seasons config: " + errors.join("; "));
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

export function getSeasonsConfigPath() {
    return SEASONS_PATH;
}

export async function loadSeasonsConfig() {
    try {
        const cfg = await readJson(SEASONS_PATH);
        validateSeasonsConfig(cfg);
        cache = cfg;
        return cache;
    } catch (e) {
        if (e.code === "ENOENT") {
            const msg = `Seasons config file not found at ${SEASONS_PATH}.
Create it (example at server/config/seasons.config.json) or set SEASONS_CONFIG_PATH env.`;
            const err = new Error(msg);
            err.cause = e;
            throw err;
        }
        throw e;
    }
}

export function getSeasonsConfig() {
    return cache; // may be null until loadSeasonsConfig() is called
}

export async function saveSeasonsConfig(newCfg) {
    validateSeasonsConfig(newCfg);
    await writeJsonAtomic(SEASONS_PATH, newCfg);
    cache = newCfg;
    return cache;
}

// Optional hot-reload on file changes (best-effort, debounced)
export function watchSeasonsConfig() {
    let timer = null;
    try {
        if (!fsSync.existsSync(SEASONS_PATH)) {
            console.warn(`[seasons] watch skipped (file does not exist yet): ${SEASONS_PATH}`);
            return;
        }
        fsSync.watch(SEASONS_PATH, { persistent: false }, () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                try {
                    await loadSeasonsConfig();
                    console.log("[seasons] config reloaded");
                } catch (e) {
                    console.error("[seasons] reload failed:", e.message);
                }
            }, 150);
        });
    } catch (e) {
        console.warn("[seasons] watch not available:", e.message);
    }
}
