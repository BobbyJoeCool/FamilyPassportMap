import http from "node:http";
import { afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import type { GoogleIdentity } from "../src/auth/google.js";

/** A Supertest agent: keeps cookies between requests, like a browser. */
export type TestAgent = ReturnType<typeof request.agent>;

// One server, listening for the whole test file, shared by every agent. Given a bare app, a
// Supertest agent re-listens and closes the same server around every request, which races
// under parallel test files (stale or mismatched responses). Supertest never closes a server
// that was already listening, so this one stays up. (Keep-alive is also off; see setup.ts.)
const server = http.createServer(app).listen(0);
afterAll(() => {
  server.close();
});

/**
 * A fresh "browser" with an empty cookie jar.
 * @returns a new agent.
 */
export function newAgent(): TestAgent {
  return request.agent(server);
}

/**
 * Encodes a fake Google identity as an authorization "code". The faked Google adapter (see
 * tests/setup.ts) decodes it back, so a test chooses exactly who Google says signed in.
 * @param identity - the identity Google should report.
 * @returns the code to pass to the callback.
 */
export function fakeCode(identity: GoogleIdentity): string {
  return Buffer.from(JSON.stringify(identity)).toString("base64url");
}

/**
 * Builds a complete fake Google identity for a test user.
 * @param name - a short lowercase name ("alice"); also used for the subject and email.
 * @param overrides - any fields to change (e.g. `emailVerified: false`).
 * @returns the identity.
 */
export function identityFor(name: string, overrides: Partial<GoogleIdentity> = {}): GoogleIdentity {
  return {
    subject: `google-${name}`,
    email: `${name}@example.com`,
    emailVerified: true,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    pictureUrl: `https://example.com/${name}.png`,
    ...overrides,
  };
}

/**
 * Walks the real sign-in flow (start → Google → callback) with the faked adapter.
 * @param agent - the cookie-keeping agent to sign in.
 * @param code - what Google hands back to the callback (see `fakeCode`).
 * @param returnTo - optional page to come back to.
 * @returns the callback's response (a redirect).
 */
export async function completeSignIn(agent: TestAgent, code: string, returnTo?: string) {
  const start = await agent.get("/api/auth/google").query(returnTo === undefined ? {} : { returnTo });
  // Starting sign-in always redirects to Google; anything else is a broken test setup.
  if (start.status !== 302) {
    throw new Error(`Sign-in start returned ${start.status}: ${JSON.stringify(start.body)} ${start.text}`);
  }
  const state = new URL(start.headers.location).searchParams.get("state");
  return agent.get("/api/auth/google/callback").query({ code, state });
}

/**
 * The session cookie a response set, as a `Cookie` header value — for sending a copy of it by
 * hand after the agent's own jar has dropped it.
 * @param res - a response that set the session cookie (e.g. the sign-in callback).
 * @returns the `fpm_session=<token>` pair.
 */
export function sessionCookieFrom(res: { headers: Record<string, unknown> }): string {
  const cookies = res.headers["set-cookie"] as string[];
  return cookies.find((cookie) => cookie.startsWith("fpm_session="))!.split(";")[0];
}

/**
 * Signs a fresh agent in as the named test User.
 * @param name - a short lowercase name ("alice").
 * @returns an agent carrying that User's session cookie.
 */
export async function signIn(name: string): Promise<TestAgent> {
  const agent = newAgent();
  const res = await completeSignIn(agent, fakeCode(identityFor(name)));
  // A failed sign-in redirects to /signin — fail loudly rather than test as signed-out.
  if (res.status !== 302 || res.headers.location.startsWith("/signin")) {
    throw new Error(`Test sign-in failed: ${res.status} ${res.headers.location}`);
  }
  return agent;
}
