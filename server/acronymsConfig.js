// server/acronymsConfig.js
// Acronyms config loader with validation, caching, and file watching

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default: <repo>/server/config/acronyms.config.json
const DEFAULT_ACRONYMS_PATH = path.join(__dirname, "config", "acronyms.config.json");

// Allow overriding via env (absolute or relative to CWD)
const ACRONYMS_PATH = process.env.ACRONYMS_CONFIG_PATH
    ? path.isAbsolute(process.env.ACRONYMS_CONFIG_PATH)
        ? process.env.ACRONYMS_CONFIG_PATH
        : path.resolve(process.env.ACRONYMS_CONFIG_PATH)
    : DEFAULT_ACRONYMS_PATH;

let cache = null;

/* ---------------------------- Validation ---------------------------- */

function validateAcronymsConfig(cfg) {
    const errors = [];

    // strokes: object with stroke categories
    if (!cfg?.strokes || typeof cfg.strokes !== "object") {
        errors.push("`strokes` must be an object");
    } else {
        Object.entries(cfg.strokes).forEach(([stroke, acronyms]) => {
            if (!Array.isArray(acronyms)) {
                errors.push(`strokes.${stroke} must be an array of strings`);
            } else {
                acronyms.forEach((acronym, idx) => {
                    if (typeof acronym !== "string") {
                        errors.push(`strokes.${stroke}[${idx}] must be a string`);
                    }
                });
            }
        });
    }

    // styles: object with style categories
    if (!cfg?.styles || typeof cfg.styles !== "object") {
        errors.push("`styles` must be an object");
    } else {
        Object.entries(cfg.styles).forEach(([style, acronyms]) => {
            if (!Array.isArray(acronyms)) {
                errors.push(`styles.${style} must be an array of strings`);
            } else {
                acronyms.forEach((acronym, idx) => {
                    if (typeof acronym !== "string") {
                        errors.push(`styles.${style}[${idx}] must be a string`);
                    }
                });
            }
        });
    }

    if (errors.length) {
        const err = new Error("Invalid acronyms config: " + errors.join("; "));
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

export function getAcronymsConfigPath() {
    return ACRONYMS_PATH;
}

export async function loadAcronymsConfig() {
    try {
        const cfg = await readJson(ACRONYMS_PATH);
        validateAcronymsConfig(cfg);
        cache = cfg;
        return cache;
    } catch (e) {
        if (e.code === "ENOENT") {
            const msg = `Acronyms config file not found at ${ACRONYMS_PATH}.
Create it (example at server/config/acronyms.config.json) or set ACRONYMS_CONFIG_PATH env.`;
            const err = new Error(msg);
            err.cause = e;
            throw err;
        }
        throw e;
    }
}

export function getAcronymsConfig() {
    return cache; // may be null until loadAcronymsConfig() is called
}

export async function saveAcronymsConfig(newCfg) {
    validateAcronymsConfig(newCfg);
    await writeJsonAtomic(ACRONYMS_PATH, newCfg);
    cache = newCfg;
    return cache;
}

// Optional hot-reload on file changes (best-effort, debounced)
export function watchAcronymsConfig() {
    let timer = null;
    try {
        if (!fsSync.existsSync(ACRONYMS_PATH)) {
            console.warn(`[acronyms] watch skipped (file does not exist yet): ${ACRONYMS_PATH}`);
            return;
        }
        fsSync.watch(ACRONYMS_PATH, { persistent: false }, () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                try {
                    await loadAcronymsConfig();
                    console.log("[acronyms] config reloaded");
                } catch (e) {
                    console.error("[acronyms] reload failed:", e.message);
                }
            }, 150);
        });
    } catch (e) {
        console.warn("[acronyms] watch not available:", e.message);
    }
}
