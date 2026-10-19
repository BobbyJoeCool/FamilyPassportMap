import crypto from "node:crypto";
import { Router, type CookieOptions } from "express";
import { prisma } from "../db.js";
import { googleAuthorizationUrl, googleIdentityFromCode } from "./google.js";
import { createSession, deleteSession, SESSION_COOKIE, sessionCookieOptions } from "./sessions.js";

/** Router for `/api/auth` — Google sign-in and sign-out. Public (no session required). */
export const authRouter = Router();

/** Where a signed-in User lands when no (valid) `returnTo` was given. */
export const DEFAULT_LANDING_PATH = "/us/map";

/** Short-lived cookie holding the in-flight sign-in's anti-forgery state and return path. */
const PENDING_SIGN_IN_COOKIE = "fpm_signin";

/** Why a sign-in didn't complete; shown on the sign-in page as `/signin?error=<reason>`. */
type SignInError = "cancelled" | "failed" | "unverified";

/**
 * Cookie settings for the pending sign-in cookie: only sent to /api/auth, gone in 10 minutes.
 * @returns options for `res.cookie` / `res.clearCookie`.
 */
function pendingCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 10 * 60 * 1000,
  };
}

/**
 * Accepts a post-sign-in destination only if it's a path inside this app, so a crafted
 * sign-in link can't bounce the User to another site.
 * @param value - the requested `returnTo` (untrusted query input).
 * @returns the path to use.
 */
export function safeReturnTo(value: unknown): string {
  // Must be a same-origin relative path: one leading "/", not "//host" or "/\host"
  // (both of which browsers treat as another origin).
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return DEFAULT_LANDING_PATH;
}

/**
 * Reads the pending sign-in cookie.
 * @param raw - the cookie's value, if any.
 * @returns the stored state and return path, or null if absent or malformed.
 */
function readPendingSignIn(raw: unknown): { state: string; returnTo: string } | null {
  // No cookie: the callback wasn't preceded by a sign-in start from this browser.
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown; returnTo?: unknown };
    // Both fields must be present; anything else is a tampered or stale cookie.
    if (typeof parsed.state !== "string" || typeof parsed.returnTo !== "string") return null;
    return { state: parsed.state, returnTo: safeReturnTo(parsed.returnTo) };
  } catch {
    return null;
  }
}

/**
 * Builds the sign-in page URL for a failed sign-in.
 * @param reason - why it failed.
 * @returns the relative URL to redirect to.
 */
function signInErrorPath(reason: SignInError): string {
  return `/signin?error=${reason}`;
}

/**
 * `GET /api/auth/google?returnTo=<path>` — start signing in: remember where to come back to,
 * then send the browser to Google.
 */
authRouter.get("/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("base64url");
  const returnTo = safeReturnTo(req.query.returnTo);
  res.cookie(PENDING_SIGN_IN_COOKIE, JSON.stringify({ state, returnTo }), pendingCookieOptions());
  res.redirect(googleAuthorizationUrl(state));
});

/**
 * `GET /api/auth/google/callback` — Google sends the browser back here. Verify it's the
 * sign-in we started, get the identity, find or create the User, start a session.
 */
authRouter.get("/google/callback", async (req, res) => {
  const pending = readPendingSignIn(req.cookies?.[PENDING_SIGN_IN_COOKIE]);
  res.clearCookie(PENDING_SIGN_IN_COOKIE, { ...pendingCookieOptions(), maxAge: undefined });

  // Google reports the user backing out (or any other consent-page problem) as `error`.
  if (req.query.error) {
    res.redirect(signInErrorPath(req.query.error === "access_denied" ? "cancelled" : "failed"));
    return;
  }

  const { code, state } = req.query;
  // The state must match the one we set, or this callback wasn't started by this browser.
  if (!pending || typeof code !== "string" || state !== pending.state) {
    res.redirect(signInErrorPath("failed"));
    return;
  }

  let identity;
  try {
    identity = await googleIdentityFromCode(code);
  } catch (error) {
    console.error("Google sign-in failed:", error);
    res.redirect(signInErrorPath("failed"));
    return;
  }

  // An unverified email can't be trusted to identify anyone — no User is created.
  if (!identity.emailVerified) {
    res.redirect(signInErrorPath("unverified"));
    return;
  }

  // Same Google account → same User; name, email and picture are refreshed every sign-in.
  const profile = { email: identity.email, displayName: identity.name, avatarUrl: identity.pictureUrl };
  const user = await prisma.user.upsert({
    where: { authProvider_authSubject: { authProvider: "google", authSubject: identity.subject } },
    create: { authProvider: "google", authSubject: identity.subject, ...profile },
    update: profile,
  });

  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.redirect(pending.returnTo);
});

/** `POST /api/auth/signout` — end this browser's session. Safe to call when signed out. */
authRouter.post("/signout", async (req, res) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  // Only a real token has a session row to delete; the cookie is cleared either way.
  if (typeof token === "string" && token !== "") await deleteSession(token);
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  res.status(204).end();
});
