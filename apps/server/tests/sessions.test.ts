import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { prisma } from "../src/db.js";
import {
  SESSION_COOKIE,
  SESSION_LIFETIME_MS,
  createSession,
  deleteSession,
  readSessionToken,
  resolveSession,
  sessionCookieOptions,
} from "../src/auth/sessions.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const originalNodeEnv = process.env.NODE_ENV;
let userId: string;

/**
 * The stored id for a raw token (the database keeps only the SHA-256 hash).
 * @param token - the raw cookie token.
 * @returns the session row's id.
 */
function hashed(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Moves a session's expiry so it has the given time left.
 * @param token - the raw cookie token.
 * @param remainingMs - how long until it expires (negative for already expired).
 */
async function setRemaining(token: string, remainingMs: number) {
  await prisma.session.update({ where: { id: hashed(token) }, data: { expiresAt: new Date(Date.now() + remainingMs) } });
}

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { authProvider: "microsoft", authSubject: "sub-alice", email: "alice@example.com", displayName: "Alice" },
  });
  userId = user.id;
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("sessionCookieOptions", () => {
  it("is httpOnly, SameSite=Lax, site-wide and lasts 30 days", () => {
    expect(sessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * DAY_MS,
    });
  });

  it("is Secure only in production", () => {
    process.env.NODE_ENV = "production";
    expect(sessionCookieOptions().secure).toBe(true);
    process.env.NODE_ENV = "development";
    expect(sessionCookieOptions().secure).toBe(false);
    delete process.env.NODE_ENV;
    expect(sessionCookieOptions().secure).toBe(false);
  });
});

describe("readSessionToken", () => {
  it("reads a non-empty session cookie", () => {
    expect(readSessionToken({ cookies: { [SESSION_COOKIE]: "abc" } } as unknown as Request)).toBe("abc");
  });

  it("is null for a missing, empty or non-string cookie", () => {
    // None of these is a usable token.
    for (const cookies of [undefined, {}, { [SESSION_COOKIE]: "" }, { [SESSION_COOKIE]: ["a"] }]) {
      expect(readSessionToken({ cookies } as unknown as Request)).toBeNull();
    }
  });
});

describe("createSession and resolveSession", () => {
  it("stores only the token's hash, expiring in 30 days", async () => {
    const token = await createSession(userId);
    expect(await prisma.session.findUnique({ where: { id: token } })).toBeNull();
    const row = await prisma.session.findUnique({ where: { id: hashed(token) } });
    expect(row?.userId).toBe(userId);
    expect(Math.abs(row!.expiresAt.getTime() - (Date.now() + SESSION_LIFETIME_MS))).toBeLessThan(5000);
  });

  it("resolves a fresh session to its User without extending it", async () => {
    const token = await createSession(userId);
    expect(await resolveSession(token)).toMatchObject({ user: { id: userId }, extended: false });
  });

  it("is null for a token that was never issued", async () => {
    expect(await resolveSession("never-issued")).toBeNull();
  });

  it("is null for an expired session, and deletes it", async () => {
    const token = await createSession(userId);
    await setRemaining(token, -1000);
    expect(await resolveSession(token)).toBeNull();
    expect(await prisma.session.count({ where: { id: hashed(token) } })).toBe(0);
  });

  it("extends a session once a day has passed since it was last extended", async () => {
    const token = await createSession(userId);
    // Just over a day used: due for extension.
    await setRemaining(token, SESSION_LIFETIME_MS - DAY_MS - 60_000);
    expect(await resolveSession(token)).toMatchObject({ extended: true });
    const row = await prisma.session.findUnique({ where: { id: hashed(token) } });
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + SESSION_LIFETIME_MS - 5000);
  });

  it("doesn't extend a session used again within the day", async () => {
    const token = await createSession(userId);
    await setRemaining(token, SESSION_LIFETIME_MS - DAY_MS + 60_000);
    expect(await resolveSession(token)).toMatchObject({ extended: false });
  });
});

describe("deleteSession", () => {
  it("ends the session", async () => {
    const token = await createSession(userId);
    await deleteSession(token);
    expect(await resolveSession(token)).toBeNull();
  });

  it("ignores an unknown token", async () => {
    await expect(deleteSession("unknown")).resolves.toBeUndefined();
  });
});
