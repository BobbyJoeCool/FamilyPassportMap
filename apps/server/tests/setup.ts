import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterAll, vi } from "vitest";

// Microsoft is the one thing tests fake (the agreed seam). The "code" a test hands the callback is
// the identity itself, base64url-encoded (see tests/helpers.ts fakeCode); "bad-code" simulates
// a failed exchange or verification.
vi.mock("../src/auth/microsoft.js", () => ({
  /**
   * Fake sign-in-page URL: just carries the state, as Microsoft's would.
   * @param state - the anti-forgery value the callback must get back.
   * @returns a URL whose `state` query parameter tests can read.
   */
  microsoftAuthorizationUrl: (state: string) => `https://login.microsoftonline.test/common/oauth2/v2.0/authorize?state=${state}`,
  /**
   * Fake code exchange: the code IS the identity, base64url-encoded by `fakeCode`.
   * @param code - what the test passed to the callback.
   * @returns the identity encoded in the code.
   * @throws for "bad-code", like a code Microsoft rejects.
   */
  microsoftIdentityFromCode: async (code: string) => {
    // Simulate Microsoft refusing the exchange or the ID token failing verification.
    if (code === "bad-code") throw new Error("Microsoft rejected the code");
    return JSON.parse(Buffer.from(code, "base64url").toString("utf8"));
  },
}));

// Google and GitHub are faked the same way: the "code" is the identity, base64url-encoded (see
// tests/helpers.ts providerCode); "bad-code" fails.
/**
 * A fake provider adapter's code exchange.
 * @param code - the identity, base64url-encoded, or "bad-code".
 * @returns the decoded identity.
 */
async function decodeFakeCode(code: string) {
  // Simulate the provider refusing the exchange.
  if (code === "bad-code") throw new Error("Provider rejected the code");
  return JSON.parse(Buffer.from(code, "base64url").toString("utf8"));
}
vi.mock("../src/auth/google.js", () => ({
  googleAuthorizationUrl: (state: string) => `https://accounts.google.test/o/oauth2/v2/auth?state=${state}`,
  googleIdentityFromCode: decodeFakeCode,
}));
vi.mock("../src/auth/github.js", () => ({
  githubAuthorizationUrl: (state: string) => `https://github.test/login/oauth/authorize?state=${state}`,
  githubIdentityFromCode: decodeFakeCode,
}));

// No email leaves a test: sendMail records into an in-memory outbox tests read and clear.
vi.mock("../src/auth/mailer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/mailer.js")>();
  const outbox: import("../src/auth/mailer.js").MailMessage[] = [];
  return {
    ...actual,
    outbox,
    /**
     * Records the message instead of sending it.
     * @param message - the email.
     */
    sendMail: async (message: import("../src/auth/mailer.js").MailMessage) => {
      outbox.push(message);
    },
  };
});

// Every provider counts as set up in tests (each adapter is faked above or below), so their start
// routes exist. Tests about disabled providers clear these for themselves.
process.env.MICROSOFT_CLIENT_ID = "test-microsoft-id";
process.env.MICROSOFT_CLIENT_SECRET = "test-microsoft-secret";
process.env.GOOGLE_CLIENT_ID = "test-google-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.GITHUB_CLIENT_ID = "test-github-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-secret";
process.env.APP_BASE_URL = "http://localhost:5173";

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
  // Every test starts with an empty outbox and fresh rate limits.
  (await import("../src/auth/mailer.js")).outbox.length = 0;
  (await import("../src/auth/rateLimit.js")).resetRateLimits();
  const prisma = await getPrisma();
  await prisma.visitedState.deleteMany();
  await prisma.visitedCountry.deleteMany();
  await prisma.person.deleteMany();
  await prisma.session.deleteMany();
  await prisma.emailCode.deleteMany();
  await prisma.passkey.deleteMany();
  await prisma.signInMethod.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  const prisma = await getPrisma();
  await prisma.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
