import { afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { missingAuthSettings } from "../src/auth/config.js";
import { completeSignIn, fakeCode, identityFor, newAgent, sessionCookieFrom, signIn } from "./helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Signs a User in and completes their welcome step, so later sign-ins go to `returnTo`
 * rather than to /welcome.
 * @param name - a short lowercase name ("alice").
 */
async function finishWelcome(name: string): Promise<void> {
  const agent = await signIn(name);
  await agent.post("/api/me/primary-person").send({ name, colorHex: "#123456" });
}

describe("Signing in", () => {
  it("GET /api/me is 401 when signed out", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not signed in" });
  });

  it("signing in with Microsoft creates a User that /api/me returns", async () => {
    const alice = await signIn("alice");
    const res = await alice.get("/api/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: "alice@example.com",
      displayName: "Alice",
      // Microsoft's ID token has no picture.
      avatarUrl: null,
    });
    expect(res.body.user.id).toBeDefined();
  });
});

describe("Sign-in outcomes", () => {
  it("signing in again with the same Microsoft account reuses the User and refreshes their profile", async () => {
    const first = await (await signIn("alice")).get("/api/me");

    const agent = newAgent();
    const renamed = identityFor("alice", { name: "Alice Smith", email: "alice.smith@example.com" });
    await completeSignIn(agent, fakeCode(renamed));
    const second = await agent.get("/api/me");

    expect(second.body.user).toEqual({
      id: first.body.user.id,
      email: "alice.smith@example.com",
      displayName: "Alice Smith",
      avatarUrl: null,
    });
  });

  it("a successful sign-in redirects to the requested page", async () => {
    await finishWelcome("alice");
    const res = await completeSignIn(newAgent(), fakeCode(identityFor("alice")), "/world/list");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/world/list");
  });

  it.each(["https://evil.example.com/", "//evil.example.com/", "/\\evil.example.com", "javascript:alert(1)"])(
    "an outside returnTo (%s) falls back to the US map",
    async (returnTo) => {
      await finishWelcome("alice");
      const res = await completeSignIn(newAgent(), fakeCode(identityFor("alice")), returnTo);
      expect(res.headers.location).toBe("/us/map");
    },
  );

  it("a work or school account signs in like a personal one", async () => {
    const agent = newAgent();
    const res = await completeSignIn(agent, fakeCode(identityFor("alice", { isPersonalAccount: false })));
    expect(res.headers.location).toBe("/welcome");
    expect((await agent.get("/api/me")).body.user).toMatchObject({ email: "alice@example.com" });
  });

  it("two accounts with the same email are two different Users", async () => {
    const personal = newAgent();
    await completeSignIn(personal, fakeCode(identityFor("alice")));
    const work = newAgent();
    await completeSignIn(work, fakeCode(identityFor("alice", { subject: "microsoft-alice-work", isPersonalAccount: false })));

    // Users are keyed by Microsoft's account id, never by email, which a work directory can set freely.
    expect((await personal.get("/api/me")).body.user.id).not.toBe((await work.get("/api/me")).body.user.id);
  });

  it("cancelling at Microsoft returns to the sign-in page with a cancelled message", async () => {
    const agent = newAgent();
    await agent.get("/api/auth/microsoft");
    const res = await agent.get("/api/auth/microsoft/callback").query({ error: "access_denied" });
    expect(res.headers.location).toBe("/signin?error=cancelled");
  });

  it("a code Microsoft rejects ends in a failed sign-in", async () => {
    const res = await completeSignIn(newAgent(), "bad-code");
    expect(res.headers.location).toBe("/signin?error=failed");
  });

  it("a callback that this browser didn't start (state mismatch) fails", async () => {
    const agent = newAgent();
    await agent.get("/api/auth/microsoft");
    const res = await agent
      .get("/api/auth/microsoft/callback")
      .query({ code: fakeCode(identityFor("alice")), state: "forged" });
    expect(res.headers.location).toBe("/signin?error=failed");
    expect((await agent.get("/api/me")).status).toBe(401);
  });

  it("a callback with no sign-in started at all fails", async () => {
    const res = await request(app)
      .get("/api/auth/microsoft/callback")
      .query({ code: fakeCode(identityFor("alice")), state: "anything" });
    expect(res.headers.location).toBe("/signin?error=failed");
  });
});

describe("Sessions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("signing out ends the session", async () => {
    const alice = await signIn("alice");
    expect((await alice.post("/api/auth/signout")).status).toBe(204);
    expect((await alice.get("/api/me")).status).toBe(401);
  });

  it("the server refuses a session unused for more than 30 days, even if the cookie is still sent", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-01T00:00:00Z") });
    const signedIn = await completeSignIn(newAgent(), fakeCode(identityFor("alice")));
    // Send the cookie by hand: a real browser drops it after Max-Age, but a copied cookie
    // must still be refused by the server itself.
    const sessionCookie = sessionCookieFrom(signedIn);

    vi.setSystemTime(new Date(Date.now() + 31 * DAY_MS)); // never used since sign-in
    expect((await request(app).get("/api/me").set("Cookie", sessionCookie)).status).toBe(401);
  });

  it("using the app keeps the session alive past 30 days from sign-in", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-01T00:00:00Z") });
    const alice = await signIn("alice");

    vi.setSystemTime(new Date(Date.now() + 20 * DAY_MS));
    expect((await alice.get("/api/me")).status).toBe(200);

    vi.setSystemTime(new Date(Date.now() + 20 * DAY_MS)); // 40 days after sign-in
    expect((await alice.get("/api/me")).status).toBe(200);
  });
});

describe("Protected routes", () => {
  it.each([
    ["get", "/api/people"],
    ["get", "/api/people/allowance"],
    ["post", "/api/me/primary-person"],
    ["delete", "/api/me"],
    ["post", "/api/people/some-id/claim"],
    ["post", "/api/people"],
    ["patch", "/api/people/some-id"],
    ["delete", "/api/people/some-id"],
    ["post", "/api/people/some-id/photo"],
    ["get", "/api/people/some-id/visits"],
    ["put", "/api/people/some-id/visits/CA"],
    ["delete", "/api/people/some-id/visits/CA"],
    ["get", "/api/people/some-id/countries"],
    ["put", "/api/people/some-id/countries/FR"],
    ["delete", "/api/people/some-id/countries/FR"],
    ["get", "/api/visits"],
    ["get", "/api/countries"],
  ] as const)("%s %s is 401 when signed out", async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not signed in" });
  });

  it("GET /api/health stays public", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});

describe("Sign-in configuration", () => {
  it("reports every missing Microsoft setting", () => {
    expect(missingAuthSettings({})).toEqual(["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "APP_BASE_URL"]);
    expect(missingAuthSettings({ MICROSOFT_CLIENT_ID: "id", MICROSOFT_CLIENT_SECRET: "", APP_BASE_URL: "http://x" })).toEqual([
      "MICROSOFT_CLIENT_SECRET",
    ]);
  });

  it("reports nothing when sign-in is fully configured", () => {
    expect(
      missingAuthSettings({ MICROSOFT_CLIENT_ID: "id", MICROSOFT_CLIENT_SECRET: "secret", APP_BASE_URL: "http://localhost:5173" }),
    ).toEqual([]);
  });
});
