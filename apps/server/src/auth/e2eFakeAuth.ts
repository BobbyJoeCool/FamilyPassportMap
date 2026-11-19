import { Router } from "express";
import type { MicrosoftIdentity } from "./microsoft.js";

// The E2E-only stand-in for Microsoft sign-in. Playwright drives a real browser, which can't use
// the unit tests' module mock (tests/setup.ts), so with E2E_FAKE_AUTH=true the sign-in start
// redirects to a local page instead of Microsoft. That page asks for a short user name and hands
// it back to the normal callback as the "code"; everything after the callback (Users, sessions,
// cookies, the welcome step) runs for real. Never on in production: the server refuses to start
// with both set (index.ts), and `isE2eFakeAuthEnabled` is false in production regardless.

/** A fake "code" is just the user name: lowercase letters, digits and dashes. */
const FAKE_USER_NAME = /^[a-z0-9-]{1,40}$/;

/**
 * Whether the fake sign-in replaces Microsoft for this process. Read per request, so tests can
 * switch it on and off.
 * @param env - the environment to check (defaults to `process.env`).
 * @returns true only when `E2E_FAKE_AUTH` is exactly "true" and this isn't production.
 */
export function isE2eFakeAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.E2E_FAKE_AUTH === "true" && env.NODE_ENV !== "production";
}

/**
 * Whether the fake sign-in was asked for in production, a misconfiguration the server refuses
 * to start with.
 * @param env - the environment to check (defaults to `process.env`).
 * @returns true when both `E2E_FAKE_AUTH=true` and `NODE_ENV=production` are set.
 */
export function isE2eFakeAuthMisconfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.E2E_FAKE_AUTH === "true" && env.NODE_ENV === "production";
}

/**
 * The fake sign-in page URL, used in place of Microsoft's. Relative, so it works through the
 * Vite dev proxy as well as straight against the server.
 * @param state - the anti-forgery value the callback must get back.
 * @returns the URL to redirect to.
 */
export function fakeAuthorizationUrl(state: string): string {
  return `/api/auth/e2e/authorize?state=${encodeURIComponent(state)}`;
}

/**
 * Turns a fake "code" (a user name) into the identity Microsoft would have reported: a personal
 * account, so the identity behaves like a typical real sign-in.
 * @param code - the user name typed on the fake page, e.g. "alice".
 * @returns the identity for that name: subject "e2e-alice", email "alice@e2e.test", name "Alice".
 * @throws for anything that isn't a valid user name, like a code Microsoft rejects.
 */
export async function fakeIdentityFromCode(code: string): Promise<MicrosoftIdentity> {
  // Same outcome as a bad Microsoft code: the callback ends on the sign-in page with an error.
  if (!FAKE_USER_NAME.test(code)) throw new Error(`Not a valid fake E2E user name: ${JSON.stringify(code)}`);
  return {
    subject: `e2e-${code}`,
    email: `${code}@e2e.test`,
    name: code.charAt(0).toUpperCase() + code.slice(1),
    isPersonalAccount: true,
  };
}

/**
 * Escapes text for safe use inside HTML attribute values and content.
 * @param value - untrusted text (here, the `state` query parameter).
 * @returns the escaped text.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Router for `/api/auth/e2e` — the fake sign-in page. A plain 404 unless fake sign-in is on. */
export const e2eAuthRouter = Router();

/**
 * `GET /api/auth/e2e/authorize?state=…` — a minimal "Microsoft" page: one field for the user
 * name, submitted (no JavaScript) straight to the real callback as `code`, with the state.
 */
e2eAuthRouter.get("/authorize", (req, res, next) => {
  // Off (always in production): behave as if the route doesn't exist.
  if (!isE2eFakeAuthEnabled()) {
    next();
    return;
  }
  const state = typeof req.query.state === "string" ? req.query.state : "";
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Fake sign-in (E2E)</title></head>
  <body>
    <h1>Fake sign-in (E2E tests only)</h1>
    <form method="get" action="/api/auth/microsoft/callback">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <label>User name <input name="code" autocomplete="off" required></label>
      <button type="submit">Sign in</button>
    </form>
  </body>
</html>`);
});
