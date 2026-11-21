import crypto from "node:crypto";
import { Router, type CookieOptions } from "express";
import {
  isProvider,
  safeReturnTo,
  type AvailableSignInMethods,
  type Provider,
  type SignInError,
  type SignInIntent,
} from "@familypassportmap/shared";
import { adoptLegacyPeople } from "../access.js";
import { enabledProviders, isLegacyDataOwner, isProviderEnabled } from "./config.js";
import { passkeyRouter } from "./passkeyRoutes.js";
import { e2eAuthRouter, fakeAuthorizationUrl, fakeIdentityFromCode, isE2eFakeAuthEnabled } from "./e2eFakeAuth.js";
import { providerAdapter, type ProviderIdentity } from "./providers.js";
import { deleteSession, readSessionToken, SESSION_COOKIE, sessionCookieOptions } from "./sessions.js";
import { ACCOUNT_SIGN_IN_PATH, attachMethod, landingPath, signInWithMethod, startSession } from "./signInMethods.js";

/**
 * Router for `/api/auth`: which sign-in methods exist, provider sign-in (Microsoft, Google,
 * GitHub), and sign-out. Public (no session required); `loadUser` has already run, so a
 * signed-in User is known when adding a sign-in method.
 */
export const authRouter = Router();

// The E2E-only fake sign-in page (a 404 unless E2E_FAKE_AUTH=true outside production).
authRouter.use("/e2e", e2eAuthRouter);
// Passkeys (no settings needed beyond APP_BASE_URL).
authRouter.use("/passkey", passkeyRouter);

/** Short-lived cookie holding the in-flight provider sign-in: state, provider, intent, return path. */
const PENDING_SIGN_IN_COOKIE = "fpm_signin";

/** What the pending sign-in cookie holds. */
interface PendingSignIn {
  state: string;
  provider: Provider;
  intent: SignInIntent;
  returnTo: string;
  /** The User who started an add; null for a sign-in. The callback only adds to this same User. */
  userId: string | null;
}

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
 * @returns what it holds, or null if absent or malformed.
 */
function readPendingSignIn(raw: unknown): PendingSignIn | null {
  // No cookie: the callback wasn't preceded by a sign-in start from this browser.
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof PendingSignIn, unknown>>;
    // Every field must be present and valid; anything else is a tampered or stale cookie.
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.returnTo !== "string" ||
      !isProvider(parsed.provider) ||
      (parsed.intent !== "sign-in" && parsed.intent !== "add") ||
      // An add must say who started it; a sign-in has nobody yet.
      (parsed.intent === "add" ? typeof parsed.userId !== "string" : parsed.userId !== null)
    ) {
      return null;
    }
    return {
      state: parsed.state,
      provider: parsed.provider,
      intent: parsed.intent,
      returnTo: safeReturnTo(parsed.returnTo),
      // Checked above: a string for an add, null for a sign-in.
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Where a failed provider round trip ends: the sign-in page, or the Sign-in methods page when the
 * User was adding a method.
 * @param intent - what the round trip was for.
 * @param reason - why it failed.
 * @returns the relative URL to redirect to.
 */
function errorPath(intent: SignInIntent, reason: SignInError): string {
  return `${intent === "add" ? ACCOUNT_SIGN_IN_PATH : "/signin"}?error=${reason}`;
}

/**
 * `GET /api/auth/methods` — which ways of signing in this server offers, so the sign-in page only
 * shows buttons that work.
 */
authRouter.get("/methods", (_req, res) => {
  const body: AvailableSignInMethods = {
    providers: enabledProviders(),
    passkeys: true,
  };
  res.json(body);
});

/** `POST /api/auth/signout` — end this browser's session. Safe to call when signed out. */
authRouter.post("/signout", async (req, res) => {
  const token = readSessionToken(req);
  // Only a real token has a session row to delete; the cookie is cleared either way.
  if (token) await deleteSession(token);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  // An add started before signing out must not finish for whoever signs in next.
  res.clearCookie(PENDING_SIGN_IN_COOKIE, pendingCookieOptions());
  res.status(204).end();
});

/**
 * `GET /api/auth/:provider?returnTo=<path>&intent=sign-in|add` — start a provider round trip:
 * remember what it's for and where to come back to, then send the browser to the provider.
 * Adding (`intent=add`) needs a signed-in User and always comes back to the Sign-in methods page.
 */
authRouter.get("/:provider", (req, res, next) => {
  const { provider } = req.params;
  // Not a provider (e.g. /api/auth/nothing): not this route's business.
  if (!isProvider(provider)) {
    next();
    return;
  }
  // A provider that isn't set up has no start route, so no broken round trip can begin.
  if (!isProviderEnabled(provider)) {
    res.sendStatus(404);
    return;
  }

  const intent: SignInIntent = req.query.intent === "add" ? "add" : "sign-in";
  // Adding needs an account to add to: sign in first, then come back to the Sign-in methods page.
  if (intent === "add" && !req.user) {
    res.redirect(`/signin?returnTo=${encodeURIComponent(ACCOUNT_SIGN_IN_PATH)}`);
    return;
  }

  const state = crypto.randomBytes(16).toString("base64url");
  const returnTo = intent === "add" ? ACCOUNT_SIGN_IN_PATH : safeReturnTo(req.query.returnTo);
  // An add remembers who started it, so the callback can't add to a different account.
  const pending: PendingSignIn = { state, provider, intent, returnTo, userId: intent === "add" ? req.user!.id : null };
  res.cookie(PENDING_SIGN_IN_COOKIE, JSON.stringify(pending), pendingCookieOptions());
  // E2E runs sign in through the local fake page instead of the provider.
  res.redirect(isE2eFakeAuthEnabled() ? fakeAuthorizationUrl(provider, state) : providerAdapter(provider).authorizationUrl(state));
});

/**
 * `GET /api/auth/:provider/callback` — the provider sends the browser back here. Check it's the
 * round trip this browser started, get the identity, then sign in (finding or creating the User)
 * or add the method to the signed-in account.
 */
authRouter.get("/:provider/callback", async (req, res, next) => {
  const { provider } = req.params;
  // Not a provider: not this route's business.
  if (!isProvider(provider)) {
    next();
    return;
  }
  const pending = readPendingSignIn(req.cookies?.[PENDING_SIGN_IN_COOKIE]);
  // Express 5 clearCookie drops maxAge itself, so the same options can be reused.
  res.clearCookie(PENDING_SIGN_IN_COOKIE, pendingCookieOptions());
  const intent = pending?.intent ?? "sign-in";

  // The provider reports the user backing out (or any other sign-in-page problem) as `error`.
  if (req.query.error) {
    res.redirect(errorPath(intent, req.query.error === "access_denied" ? "cancelled" : "failed"));
    return;
  }

  const { code, state } = req.query;
  // The state and provider must match the round trip this browser started.
  if (!pending || typeof code !== "string" || state !== pending.state || pending.provider !== provider) {
    res.redirect(errorPath(intent, "failed"));
    return;
  }

  let identity: ProviderIdentity;
  try {
    // Under E2E fake sign-in the code is a test user name, not a provider code.
    identity = await (isE2eFakeAuthEnabled() ? fakeIdentityFromCode(provider, code) : providerAdapter(provider).identityFromCode(code));
  } catch (error) {
    console.error(`${provider} sign-in failed:`, error);
    res.redirect(errorPath(intent, "failed"));
    return;
  }
  const methodIdentity = { kind: provider, subject: identity.subject, email: identity.email, name: identity.name, avatarUrl: identity.avatarUrl };

  try {
    // Adding to the signed-in account: attach, unless another account already has it.
    if (intent === "add") {
      // The session ended during the round trip: nothing to add it to.
      if (!req.user) {
        res.redirect(errorPath("sign-in", "failed"));
        return;
      }
      // Someone else signed in during the round trip: the identity belongs to whoever started the
      // add, so attaching it to this account would let them into it.
      if (req.user.id !== pending.userId) {
        res.redirect(errorPath("add", "failed"));
        return;
      }
      const outcome = await attachMethod(req.user.id, methodIdentity);
      res.redirect(outcome === "taken" ? errorPath("add", "taken") : ACCOUNT_SIGN_IN_PATH);
      return;
    }

    // Signing in: the User who has this account, or a new one.
    const { user } = await signInWithMethod(methodIdentity);
    // The site owner Adopts any Legacy People, on every sign-in (a no-op once none are left).
    // Only a personal Microsoft account's email is trusted for this.
    if (identity.email && isLegacyDataOwner(identity.email, identity.isPersonalMicrosoftAccount)) {
      const adopted = await adoptLegacyPeople({ userId: user.id });
      // Only worth a log line when something actually changed hands.
      if (adopted > 0) console.log(`Adopted ${adopted} Legacy People for the site owner`);
    }
    await startSession(res, user.id);
    // No Primary Person yet: the welcome step comes first, whatever page was asked for.
    res.redirect(landingPath(user, pending.returnTo));
  } catch (error) {
    // A database failure here still ends on a page with a message, not a raw error page.
    console.error("Saving the sign-in failed:", error);
    res.redirect(errorPath(intent, "failed"));
  }
});
