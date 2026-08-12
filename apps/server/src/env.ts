import fs from "node:fs";
import path from "node:path";

// DATA_DIR is relative to apps/server's root (see .env.example) — resolve it to an
// absolute path once here so every module that touches disk agrees on the same location.
export const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? "./data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
