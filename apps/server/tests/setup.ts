import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterAll } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fpm-test-"));
const dbPath = path.join(tmpDir, "test.db");

process.env.DATABASE_URL = `file:${dbPath}`;
process.env.DATA_DIR = tmpDir;

const serverRoot = path.resolve(import.meta.dirname, "..");

execSync("npx prisma migrate deploy", {
  cwd: serverRoot,
  env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  stdio: "pipe",
});

let prismaModule: typeof import("../src/db.js") | null = null;

async function getPrisma() {
  if (!prismaModule) {
    prismaModule = await import("../src/db.js");
  }
  return prismaModule.prisma;
}

beforeEach(async () => {
  const prisma = await getPrisma();
  await prisma.visitedState.deleteMany();
  await prisma.person.deleteMany();
});

afterAll(async () => {
  const prisma = await getPrisma();
  await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
