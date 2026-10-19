import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterAll, vi } from "vitest";

// Google is the one thing tests fake (the agreed seam). The "code" a test hands the callback is
// the identity itself, base64url-encoded (see tests/helpers.ts fakeCode); "bad-code" simulates
// a failed exchange or verification.
vi.mock("../src/auth/google.js", () => ({
  /**
   * Fake consent-page URL: just carries the state, as Google's would.
   * @param state - the anti-forgery value the callback must get back.
   * @returns a URL whose `state` query parameter tests can read.
   */
  googleAuthorizationUrl: (state: string) => `https://accounts.google.test/o/oauth2/auth?state=${state}`,
  /**
   * Fake code exchange: the code IS the identity, base64url-encoded by `fakeCode`.
   * @param code - what the test passed to the callback.
   * @returns the identity encoded in the code.
   * @throws for "bad-code", like a code Google rejects.
   */
  googleIdentityFromCode: async (code: string) => {
    // Simulate Google refusing the exchange or the ID token failing verification.
    if (code === "bad-code") throw new Error("Google rejected the code");
    return JSON.parse(Buffer.from(code, "base64url").toString("utf8"));
  },
}));

// No keep-alive for test requests. Supertest starts and stops servers constantly; with Node's
// default keep-alive (Node 19+), a pooled socket can outlive its server and a later request
// gets a stale or someone else's response (seen as "Parse Error: Expected HTTP/" and as a
// signed-out request answered as if signed in).
http.globalAgent = new http.Agent({ keepAlive: false });

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
  await prisma.visitedCountry.deleteMany();
  await prisma.person.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  const prisma = await getPrisma();
  await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
