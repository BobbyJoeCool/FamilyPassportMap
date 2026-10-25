import crypto from "node:crypto";
import { Router, type CookieOptions } from "express";
import { safeReturnTo, type SignInError } from "@familypassportmap/shared";
import { adoptLegacyPeople } from "../access.js";
import { prisma } from "../db.js";
import { isLegacyDataOwner } from "./config.js";
import { microsoftAuthorizationUrl, microsoftIdentityFromCode } from "./microsoft.js";
import { createSession, deleteSession, readSessionToken, SESSION_COOKIE, sessionCookieOptions } from "./sessions.js";

/** Router for `/api/auth` — Microsoft sign-in and sign-out. Public (no session required). */
export const authRouter = Router();

/** Where a User with no Primary Person yet is sent after signing in. */
const WELCOME_PATH = "/welcome";

/** The `User.authProvider` value for Microsoft sign-ins. */
const MICROSOFT_AUTH_PROVIDER = "microsoft";

/** Short-lived cookie holding the in-flight sign-in's anti-forgery state and return path. */
const PENDING_SIGN_IN_COOKIE = "fpm_signin";

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
 * `GET /api/auth/microsoft?returnTo=<path>` — start signing in: remember where to come back to,
 * then send the browser to Microsoft.
 */
authRouter.get("/microsoft", (req, res) => {
  const state = crypto.randomBytes(16).toString("base64url");
  const returnTo = safeReturnTo(req.query.returnTo);
  res.cookie(PENDING_SIGN_IN_COOKIE, JSON.stringify({ state, returnTo }), pendingCookieOptions());
  res.redirect(microsoftAuthorizationUrl(state));
});

/**
 * `GET /api/auth/microsoft/callback` — Microsoft sends the browser back here. Verify it's the
 * sign-in we started, get the identity, find or create the User, start a session.
 */
authRouter.get("/microsoft/callback", async (req, res) => {
  const pending = readPendingSignIn(req.cookies?.[PENDING_SIGN_IN_COOKIE]);
  // Express 5 clearCookie drops maxAge itself, so the same options can be reused.
  res.clearCookie(PENDING_SIGN_IN_COOKIE, pendingCookieOptions());

  // Microsoft reports the user backing out (or any other sign-in-page problem) as `error`.
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
    identity = await microsoftIdentityFromCode(code);
  } catch (error) {
    console.error("Microsoft sign-in failed:", error);
    res.redirect(signInErrorPath("failed"));
    return;
  }

  let token: string;
  let primaryPersonId: string | null;
  try {
    // Same Microsoft account → same User (keyed by its id, never by email); name and email are
    // refreshed every sign-in. Microsoft's ID token carries no picture, so there's no avatar.
    const providerDetails = { email: identity.email, displayName: identity.name, avatarUrl: null };
    const user = await prisma.user.upsert({
      where: { authProvider_authSubject: { authProvider: MICROSOFT_AUTH_PROVIDER, authSubject: identity.subject } },
      create: { authProvider: MICROSOFT_AUTH_PROVIDER, authSubject: identity.subject, ...providerDetails },
      update: providerDetails,
    });
    // The site owner Adopts any Legacy People, on every sign-in (a no-op once none are left).
    if (isLegacyDataOwner(identity.email, identity.isPersonalAccount)) {
      const adopted = await adoptLegacyPeople({ userId: user.id });
      // Only worth a log line when something actually changed hands.
      if (adopted > 0) console.log(`Adopted ${adopted} Legacy People for the site owner`);
    }
    token = await createSession(user.id);
    primaryPersonId = user.primaryPersonId;
  } catch (error) {
    // A database failure here still ends on the sign-in page, not a raw error page.
    console.error("Saving the signed-in User failed:", error);
    res.redirect(signInErrorPath("failed"));
    return;
  }

  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  // No Primary Person yet: the welcome step comes first, whatever page was asked for.
  res.redirect(primaryPersonId ? pending.returnTo : WELCOME_PATH);
});

/** `POST /api/auth/signout` — end this browser's session. Safe to call when signed out. */
authRouter.post("/signout", async (req, res) => {
  const token = readSessionToken(req);
  // Only a real token has a session row to delete; the cookie is cleared either way.
  if (token) await deleteSession(token);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).end();
});
