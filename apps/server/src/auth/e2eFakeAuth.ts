import { Router } from "express";
import { isProvider, PROVIDER_LABELS, type Provider } from "@familypassportmap/shared";
import type { ProviderIdentity } from "./providers.js";

// The E2E-only stand-in for every sign-in provider (Microsoft, Google, GitHub). Playwright drives a real browser, which can't use
// the unit tests' module mocks (tests/setup.ts), so with E2E_FAKE_AUTH=true the sign-in start
// redirects to a local page instead of the provider. That page asks for a short user name and hands
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
 * The fake sign-in page URL for a provider, used in place of the provider's own. Relative, so it
 * works through the Vite dev proxy as well as straight against the server.
 * @param provider - which provider the page stands in for.
 * @param state - the anti-forgery value the callback must get back.
 * @returns the URL to redirect to.
 */
export function fakeAuthorizationUrl(provider: Provider, state: string): string {
  return `/api/auth/e2e/authorize?provider=${provider}&state=${encodeURIComponent(state)}`;
}

/**
 * Turns a fake "code" (a user name) into the identity the provider would have reported. Each
 * provider gets its own subject, so "alice" on Google and "alice" on Microsoft are two different
 * accounts with the same email, as they would be for real. Microsoft keeps the Phase 12 subject
 * ("e2e-alice") and is a personal account.
 * @param provider - which provider's sign-in this stands in for.
 * @param code - the user name typed on the fake page, e.g. "alice".
 * @returns the identity: email "alice@e2e.test", name "Alice", no picture.
 * @throws for anything that isn't a valid user name, like a code a provider rejects.
 */
export async function fakeIdentityFromCode(provider: Provider, code: string): Promise<ProviderIdentity> {
  // Same outcome as a bad provider code: the callback ends on the sign-in page with an error.
  if (!FAKE_USER_NAME.test(code)) throw new Error(`Not a valid fake E2E user name: ${JSON.stringify(code)}`);
  return {
    subject: provider === "microsoft" ? `e2e-${code}` : `e2e-${provider}-${code}`,
    email: `${code}@e2e.test`,
    name: code.charAt(0).toUpperCase() + code.slice(1),
    avatarUrl: null,
    isPersonalMicrosoftAccount: provider === "microsoft",
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
 * `GET /api/auth/e2e/authorize?provider=…&state=…` — a minimal stand-in for the provider's page: one
 * field for the user name, submitted (no JavaScript) straight to that provider's real callback as
 * `code`, with the state.
 */
e2eAuthRouter.get("/authorize", (req, res, next) => {
  // Off (always in production): behave as if the route doesn't exist.
  if (!isE2eFakeAuthEnabled()) {
    next();
    return;
  }
  const state = typeof req.query.state === "string" ? req.query.state : "";
  // Older links (Phase 12) had no provider; they were all Microsoft.
  const provider: Provider = isProvider(req.query.provider) ? req.query.provider : "microsoft";
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Fake sign-in (E2E)</title></head>
  <body>
    <h1>Fake sign-in (E2E tests only)</h1>
    <p>Signing in with ${PROVIDER_LABELS[provider]}</p>
    <form method="get" action="/api/auth/${provider}/callback">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <label>User name <input name="code" autocomplete="off" required></label>
      <button type="submit">Sign in</button>
    </form>
  </body>
</html>`);
});
