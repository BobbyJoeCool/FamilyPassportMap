import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { completeProviderRoundTrip, fakeCode, identityFor, newAgent, providerCode, signIn } from "./helpers.js";

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
