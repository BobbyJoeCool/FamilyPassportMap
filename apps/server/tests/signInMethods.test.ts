import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { createSession } from "../src/auth/sessions.js";
import { signInWithMethod } from "../src/auth/signInMethods.js";
import { completeSignIn, fakeCode, identityFor, newAgent, signIn, type TestAgent } from "./helpers.js";

// Phase 13's sign-in-method model, through the provider routes (Microsoft is the faked adapter;
// Google and GitHub get their own tests once built).

const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SMTP_HOST"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  // Put back any provider or mail setting a test changed.
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/**
 * Walks the "add a sign-in method" round trip with the faked Microsoft adapter.
 * @param agent - a signed-in agent.
 * @param name - the Microsoft account to add (see `identityFor`).
 * @returns the callback's response (a redirect).
 */
async function addMicrosoftAccount(agent: TestAgent, name: string) {
  const start = await agent.get("/api/auth/microsoft").query({ intent: "add" });
  expect(start.status).toBe(302);
  const state = new URL(start.headers.location).searchParams.get("state");
  return agent.get("/api/auth/microsoft/callback").query({ code: fakeCode(identityFor(name)), state });
}

/**
 * The id of the User who signed in with a Microsoft account.
 * @param name - the account's test name.
 * @returns the User id.
 */
async function userIdFor(name: string): Promise<string> {
  const method = await prisma.signInMethod.findUniqueOrThrow({
    where: { kind_subject: { kind: "microsoft", subject: `microsoft-${name}` } },
  });
  return method.userId;
}

describe("GET /api/auth/methods", () => {
  it("lists only the providers that are set up, and whether email codes are", async () => {
    const res = await newAgent().get("/api/auth/methods");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ providers: ["microsoft"], emailCodes: false, passkeys: true });
  });

  it("adds a provider once both its id and secret are set", async () => {
    process.env.GITHUB_CLIENT_ID = "id";
    expect((await newAgent().get("/api/auth/methods")).body.providers).toEqual(["microsoft"]);
    process.env.GITHUB_CLIENT_SECRET = "secret";
    expect((await newAgent().get("/api/auth/methods")).body.providers).toEqual(["microsoft", "github"]);
  });
});

describe("Provider start routes", () => {
  it("are 404 for a provider that isn't set up", async () => {
    expect((await newAgent().get("/api/auth/google")).status).toBe(404);
  });

  it("don't handle anything that isn't a provider (it falls through like any unknown /api path)", async () => {
    // Signed out, an unknown /api path is the app-wide 401, never a redirect to a provider.
    expect((await newAgent().get("/api/auth/apple")).status).toBe(401);
    expect((await newAgent().get("/api/auth/apple/callback")).status).toBe(401);
  });
});

describe("Signing in with a provider", () => {
  it("creates a User with one Microsoft sign-in method", async () => {
    await signIn("alice");
    const methods = await prisma.signInMethod.findMany();
    expect(methods).toEqual([
      expect.objectContaining({ kind: "microsoft", subject: "microsoft-alice", email: "alice@example.com" }),
    ]);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: methods[0].userId } });
    expect(user).toMatchObject({ email: "alice@example.com", displayName: "Alice", avatarUrl: null });
  });

  it("a callback for a different provider than the one started fails", async () => {
    process.env.GITHUB_CLIENT_ID = "id";
    process.env.GITHUB_CLIENT_SECRET = "secret";
    const agent = newAgent();
    const start = await agent.get("/api/auth/microsoft");
    const state = new URL(start.headers.location).searchParams.get("state");
    const res = await agent.get("/api/auth/github/callback").query({ code: "x", state });
    expect(res.headers.location).toBe("/signin?error=failed");
  });
});

describe("Adding a sign-in method", () => {
  it("attaches a new Microsoft account to the signed-in User, who can then sign in with either", async () => {
    const agent = await signIn("alice");
    const res = await addMicrosoftAccount(agent, "alice-work");
    expect(res.headers.location).toBe("/account/sign-in");

    const aliceId = await userIdFor("alice");
    expect(await userIdFor("alice-work")).toBe(aliceId);
    // Signing in with the added account lands in the same account.
    const other = newAgent();
    await completeSignIn(other, fakeCode(identityFor("alice-work")));
    expect((await other.get("/api/me")).body.user.id).toBe(aliceId);
    expect(await prisma.user.count()).toBe(1);
  });

  it("adding an account that's already yours changes nothing", async () => {
    const agent = await signIn("alice");
    const res = await addMicrosoftAccount(agent, "alice");
    expect(res.headers.location).toBe("/account/sign-in");
    expect(await prisma.signInMethod.count()).toBe(1);
  });

  it("adding an account that belongs to another User is refused as taken, and nothing changes", async () => {
    await signIn("bob");
    const agent = await signIn("alice");
    const res = await addMicrosoftAccount(agent, "bob");
    expect(res.headers.location).toBe("/account/sign-in?error=taken");
    expect(await userIdFor("bob")).not.toBe(await userIdFor("alice"));
    expect(await prisma.signInMethod.count()).toBe(2);
  });

  it("needs a signed-in User: signed out, the start sends you to sign in first", async () => {
    const res = await newAgent().get("/api/auth/microsoft").query({ intent: "add" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/signin?returnTo=%2Faccount%2Fsign-in");
  });

  it("a cancelled add returns to the Sign-in methods page", async () => {
    const agent = await signIn("alice");
    await agent.get("/api/auth/microsoft").query({ intent: "add" });
    const res = await agent.get("/api/auth/microsoft/callback").query({ error: "access_denied" });
    expect(res.headers.location).toBe("/account/sign-in?error=cancelled");
  });
});

describe("Display values", () => {
  it("a provider's details replace the stored ones; an email code leaves the name and picture alone", async () => {
    const { user } = await signInWithMethod({ kind: "google", subject: "g1", email: "a@g.com", name: "Ann", avatarUrl: "https://pic/1" });
    expect(user).toMatchObject({ email: "a@g.com", displayName: "Ann", avatarUrl: "https://pic/1" });

    await prisma.signInMethod.create({ data: { userId: user.id, kind: "email", subject: "ann@mail.com", email: "ann@mail.com" } });
    const byEmail = await signInWithMethod({ kind: "email", subject: "ann@mail.com", email: "ann@mail.com", name: null });
    expect(byEmail.user).toMatchObject({ id: user.id, email: "ann@mail.com", displayName: "Ann", avatarUrl: "https://pic/1" });

    const byGoogle = await signInWithMethod({ kind: "google", subject: "g1", email: "a@g.com", name: "Ann B", avatarUrl: null });
    expect(byGoogle).toMatchObject({ created: false, user: { displayName: "Ann B", avatarUrl: null } });
  });

  it("a User with no name from a provider takes their Primary Person's name at welcome", async () => {
    const user = await prisma.user.create({ data: { email: null, displayName: "" } });
    const agent = newAgent();
    const token = await createSession(user.id);
    await agent.post("/api/me/primary-person").set("Cookie", `fpm_session=${token}`).send({ name: "Zed", colorHex: "#123456" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).displayName).toBe("Zed");
  });

  it("a User who has a name keeps it at welcome", async () => {
    const agent = await signIn("alice");
    await agent.post("/api/me/primary-person").send({ name: "Me", colorHex: "#123456" });
    expect((await agent.get("/api/me")).body.user.displayName).toBe("Alice");
  });
});

describe("Delete account", () => {
  it("removes the User's sign-in methods too", async () => {
    const agent = await signIn("alice");
    await addMicrosoftAccount(agent, "alice-work");
    await agent.delete("/api/me");
    expect(await prisma.signInMethod.count()).toBe(0);
  });
});

describe("The sign-in methods migration", () => {
  it("copies an existing Microsoft User's sign-in into a SignInMethod and keeps the User", () => {
    // Apply every migration before Phase 13's to a fresh SQLite file, add a Phase 12 User, then
    // apply Phase 13's migration exactly as `prisma migrate deploy` would.
    const migrationsDir = path.resolve(import.meta.dirname, "../prisma/migrations");
    const folders = fs.readdirSync(migrationsDir).filter((name) => /^\d+_/.test(name)).sort();
    const target = folders.findIndex((name) => name.endsWith("_add_sign_in_methods"));
    expect(target).toBeGreaterThan(0);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fpm-migration-"));
    const db = new Database(path.join(dir, "old.db"));
    try {
      // Each earlier migration, in order.
      for (const folder of folders.slice(0, target)) db.exec(fs.readFileSync(path.join(migrationsDir, folder, "migration.sql"), "utf8"));
      db.exec(`INSERT INTO "User" (id, authProvider, authSubject, email, displayName, createdAt)
               VALUES ('u1', 'microsoft', 'sub-1', 'owner@example.com', 'Owner', 1760000000000);
               INSERT INTO "Session" (id, userId, expiresAt) VALUES ('s1', 'u1', 1900000000000);`);

      db.exec(fs.readFileSync(path.join(migrationsDir, folders[target], "migration.sql"), "utf8"));

      expect(db.prepare(`SELECT userId, kind, subject, email FROM "SignInMethod"`).all()).toEqual([
        { userId: "u1", kind: "microsoft", subject: "sub-1", email: "owner@example.com" },
      ]);
      expect(db.prepare(`SELECT id, email, displayName FROM "User"`).all()).toEqual([
        { id: "u1", email: "owner@example.com", displayName: "Owner" },
      ]);
      // The rebuilt User table didn't take the session (or anything else hanging off it) with it.
      expect(db.prepare(`SELECT count(*) AS n FROM "Session"`).get()).toEqual({ n: 1 });
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
