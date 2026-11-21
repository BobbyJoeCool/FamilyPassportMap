import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import {
  completeProviderRoundTrip,
  completeSignIn,
  fakeCode,
  identityFor,
  newAgent,
  providerCode,
  sessionCookieFrom,
  signIn,
} from "./helpers.js";

// Google and GitHub sign-in through the real routes, with their adapters faked (tests/setup.ts).

const ann = { subject: "g-ann", email: "ann@example.com", name: "Ann", avatarUrl: "https://pics.test/ann.png" };
const savedLegacyOwner = process.env.LEGACY_DATA_OWNER_EMAIL;

afterEach(() => {
  // Put back the site owner setting a test changed.
  if (savedLegacyOwner === undefined) delete process.env.LEGACY_DATA_OWNER_EMAIL;
  else process.env.LEGACY_DATA_OWNER_EMAIL = savedLegacyOwner;
});

describe.each(["google", "github"])("%s sign-in", (provider) => {
  it("a new account creates a User, with the provider's name and picture", async () => {
    const agent = newAgent();
    const res = await completeProviderRoundTrip(agent, provider, providerCode(ann));
    expect(res.headers.location).toBe("/welcome");
    const me = await agent.get("/api/me");
    expect(me.body.user).toMatchObject({ email: "ann@example.com", displayName: "Ann", avatarUrl: "https://pics.test/ann.png" });
    expect(await prisma.signInMethod.findMany({ select: { kind: true, subject: true } })).toEqual([{ kind: provider, subject: "g-ann" }]);
  });

  it("the same account signs the same User in again", async () => {
    const first = newAgent();
    await completeProviderRoundTrip(first, provider, providerCode(ann));
    const second = newAgent();
    await completeProviderRoundTrip(second, provider, providerCode({ ...ann, name: "Ann B" }));
    expect((await second.get("/api/me")).body.user).toMatchObject({
      id: (await first.get("/api/me")).body.user.id,
      displayName: "Ann B",
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it("an account with no email or name still signs in", async () => {
    const agent = newAgent();
    await completeProviderRoundTrip(agent, provider, providerCode({ subject: "bare", email: null, name: null, avatarUrl: null }));
    expect((await agent.get("/api/me")).body.user).toMatchObject({ email: null, displayName: "" });
  });

  it("a rejected code ends on the sign-in page", async () => {
    const res = await completeProviderRoundTrip(newAgent(), provider, "bad-code");
    expect(res.headers.location).toBe("/signin?error=failed");
  });

  it("can be added to an account that signed in with Microsoft, and then signs into it", async () => {
    const agent = await signIn("alice");
    const added = await completeProviderRoundTrip(agent, provider, providerCode(ann), "add");
    expect(added.headers.location).toBe("/account/sign-in");
    const other = newAgent();
    await completeProviderRoundTrip(other, provider, providerCode(ann));
    expect((await other.get("/api/me")).body.user.id).toBe((await agent.get("/api/me")).body.user.id);
  });
});

describe("Accounts across providers", () => {
  it("two providers with the same email are two different Users", async () => {
    const google = newAgent();
    await completeProviderRoundTrip(google, "google", providerCode({ ...ann, subject: "g1" }));
    const github = newAgent();
    await completeProviderRoundTrip(github, "github", providerCode({ ...ann, subject: "gh1" }));
    expect((await google.get("/api/me")).body.user.id).not.toBe((await github.get("/api/me")).body.user.id);
    expect(await prisma.user.count()).toBe(2);
  });

  it("only a personal Microsoft account Adopts the Legacy People, never Google or GitHub with that email", async () => {
    process.env.LEGACY_DATA_OWNER_EMAIL = "owner@example.com";
    await prisma.person.create({ data: { name: "Legacy", colorHex: "#000000" } });

    await completeProviderRoundTrip(newAgent(), "google", providerCode({ ...ann, email: "owner@example.com" }));
    await completeProviderRoundTrip(newAgent(), "github", providerCode({ ...ann, email: "owner@example.com" }));
    expect((await prisma.person.findFirstOrThrow()).ownerId).toBeNull();

    await completeProviderRoundTrip(newAgent(), "microsoft", fakeCode(identityFor("owner")));
    expect((await prisma.person.findFirstOrThrow()).ownerId).not.toBeNull();
  });
});

describe("Adding a provider is tied to the User who started it", () => {
  /**
   * The pending sign-in cookie a provider start set, as a `Cookie` header pair.
   * @param res - the start response.
   * @returns the `fpm_signin=<value>` pair.
   */
  function pendingCookieFrom(res: { headers: Record<string, unknown> }): string {
    const cookies = res.headers["set-cookie"] as string[];
    return cookies.find((cookie) => cookie.startsWith("fpm_signin="))!.split(";")[0];
  }

  it("refuses to add it to someone else who signed in on that browser mid-way, and attaches nothing", async () => {
    // Alice starts adding Google...
    const alice = await signIn("alice");
    const start = await alice.get("/api/auth/google").query({ intent: "add" });
    const state = new URL(start.headers.location).searchParams.get("state");
    // ...then the browser ends up signed in as Bob (e.g. a passkey sign-in in another tab, which
    // leaves the pending add in place) before Google sends it back.
    const bobSignIn = await completeSignIn(newAgent(), fakeCode(identityFor("bob")));
    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: providerCode(ann), state })
      .set("Cookie", `${sessionCookieFrom(bobSignIn)}; ${pendingCookieFrom(start)}`);

    expect(res.headers.location).toBe("/account/sign-in?error=failed");
    expect(await prisma.signInMethod.count({ where: { kind: "google" } })).toBe(0);
  });

  it("signing out drops a pending add, so it can't finish for anyone", async () => {
    const alice = await signIn("alice");
    const start = await alice.get("/api/auth/google").query({ intent: "add" });
    const state = new URL(start.headers.location).searchParams.get("state");
    const signOut = await alice.post("/api/auth/signout");
    // The pending add's cookie is cleared, not just the session's.
    expect(signOut.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringMatching(/^fpm_signin=;/)]));

    const res = await alice.get("/api/auth/google/callback").query({ code: providerCode(ann), state });
    expect(res.headers.location).toBe("/signin?error=failed");
    expect(await prisma.signInMethod.count({ where: { kind: "google" } })).toBe(0);
  });

  it("still adds when the same User comes back", async () => {
    const alice = await signIn("alice");
    const res = await completeProviderRoundTrip(alice, "google", providerCode(ann), "add");
    expect(res.headers.location).toBe("/account/sign-in");
    expect(await prisma.signInMethod.count({ where: { kind: "google" } })).toBe(1);
  });
});
