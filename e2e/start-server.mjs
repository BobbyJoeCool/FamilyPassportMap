// Starts the API server for an E2E run: a brand-new SQLite database (migrated with
// `prisma migrate deploy`), its own data folder and port, and the E2E fake sign-in in place of
// Microsoft. Playwright runs this as a webServer (see playwright.config.ts) and stops it after.
// Everything is local; nothing here can reach Azure or Microsoft.
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const serverDir = path.join(repoRoot, "apps/server");
// Not a dot-folder: Express's sendFile refuses any path with a dot-segment, so photos in
// e2e/.data/uploads would always be 404.
const dataDir = path.join(repoRoot, "e2e/test-data");

// The fake sign-in must never run as production; the server refuses too, but stop here first.
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run the E2E server with NODE_ENV=production");
  process.exit(1);
}

// A fresh database and uploads folder every run, so tests start from a known state.
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

// Every setting is given explicitly: the server's dotenv never overrides a variable that's
// already set, so a developer's apps/server/.env can't point this run at real data.
const env = {
  ...process.env,
  NODE_ENV: "development",
  E2E_FAKE_AUTH: "true",
  PORT: process.env.E2E_API_PORT ?? "3101",
  DATA_DIR: dataDir,
  DATABASE_URL: `file:${path.join(dataDir, "e2e.db")}`,
  APP_BASE_URL: `http://localhost:${process.env.E2E_WEB_PORT ?? "5273"}`,
  LEGACY_DATA_OWNER_EMAIL: "",
};

execSync("npx prisma migrate deploy", { cwd: serverDir, env, stdio: "inherit" });

const server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], { cwd: serverDir, env, stdio: "inherit" });

// Stop the server when Playwright stops this script, and exit when the server does.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
