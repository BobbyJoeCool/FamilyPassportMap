import crypto from "node:crypto";
import type { CookieOptions } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";

/** Name of the cookie that carries the session token. */
export const SESSION_COOKIE = "fpm_session";

/** A session lasts this long after it was last extended. */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/** Extend a session at most this often, so a busy session doesn't write on every request. */
const EXTEND_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Hashes a session token for storage — the database never holds a usable token.
 * @param token - the raw token from the cookie.
 * @returns its SHA-256 hex digest.
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Cookie settings for the session cookie.
 * @returns options for `res.cookie` / `res.clearCookie`.
 */
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // Lax: sent on normal navigation (including back from Google), never on cross-site
    // POST/PATCH/DELETE — which is what protects the API from cross-site requests.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_LIFETIME_MS,
  };
}

/**
 * Starts a new session for a User.
 * @param userId - the signed-in User.
 * @returns the raw token to put in the cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS) },
  });
  return token;
}

/**
 * Looks up the User behind a session token, sliding the expiry forward when due.
 * @param token - the raw token from the cookie.
 * @returns the User and whether the session was just extended (so the cookie should be
 *   re-sent), or null if the token is unknown or expired.
 */
export async function resolveSession(token: string): Promise<{ user: User; extended: boolean } | null> {
  const id = hashToken(token);
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  // Unknown token (never issued, signed out, or account deleted).
  if (!session) return null;

  const now = Date.now();
  // Expired: clean it up now rather than leaving it for a sweep.
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }

  // Slide the expiry forward, but only once it has been at least a day since the last
  // extension (i.e. less than LIFETIME − INTERVAL remains).
  const remaining = session.expiresAt.getTime() - now;
  if (remaining < SESSION_LIFETIME_MS - EXTEND_INTERVAL_MS) {
    await prisma.session.update({ where: { id }, data: { expiresAt: new Date(now + SESSION_LIFETIME_MS) } });
    return { user: session.user, extended: true };
  }
  return { user: session.user, extended: false };
}

/**
 * Ends a session (sign-out). Unknown tokens are ignored.
 * @param token - the raw token from the cookie.
 */
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
