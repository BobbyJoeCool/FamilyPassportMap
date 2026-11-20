import { describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { newAgent, signIn, type TestAgent } from "./helpers.js";
import { SoftwareAuthenticator } from "./softwareAuthenticator.js";

// Passkeys end to end, with a software authenticator standing in for the device. APP_BASE_URL is
// http://localhost:5173 in tests (tests/setup.ts), so the passkey domain is "localhost".

const ORIGIN = "http://localhost:5173";

/**
 * Creates a passkey through the register routes.
 * @param agent - the browser (signed out = sign up, signed in = add).
 * @param device - the authenticator.
 * @param body - extra fields for verify (a name).
 * @returns the verify response.
 */
async function register(agent: TestAgent, device: SoftwareAuthenticator, body: Record<string, unknown> = {}, overrides: { origin?: string } = {}) {
  const options = await agent.post("/api/auth/passkey/register/options");
  expect(options.status).toBe(200);
  return agent.post("/api/auth/passkey/register/verify").send({ response: device.createResponse(options.body, overrides), ...body });
}

/**
 * Signs in with a passkey through the sign-in routes.
 * @param agent - the browser.
 * @param device - the authenticator.
 * @param overrides - a fixed counter, to test regressions.
 * @returns the verify response.
 */
async function signInWithPasskey(agent: TestAgent, device: SoftwareAuthenticator, overrides: { counter?: number } = {}, returnTo?: string) {
  const options = await agent.post("/api/auth/passkey/signin/options");
  expect(options.status).toBe(200);
  return agent.post("/api/auth/passkey/signin/verify").send({ response: device.getResponse(options.body, overrides), returnTo });
}

describe("Passkey options", () => {
  it("ask for a discoverable passkey on this site's domain, with no attestation", async () => {
    const res = await newAgent().post("/api/auth/passkey/register/options");
    expect(res.body).toMatchObject({
      rp: { name: "FamilyPassportMap", id: "localhost" },
      attestation: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    const signin = await newAgent().post("/api/auth/passkey/signin/options");
    expect(signin.body).toMatchObject({ rpId: "localhost", userVerification: "preferred" });
    expect(signin.body.allowCredentials ?? []).toEqual([]);
  });
});

describe("Signing up and in with a passkey", () => {
  it("signing up creates an account with no email or name, on the welcome step", async () => {
    const agent = newAgent();
    const res = await register(agent, new SoftwareAuthenticator(ORIGIN));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ redirectTo: "/welcome" });
    expect((await agent.get("/api/me")).body.user).toMatchObject({ email: null, displayName: "" });
    expect(await prisma.passkey.findMany({ select: { name: true, signCount: true } })).toEqual([{ name: "Passkey", signCount: 0 }]);
  });

  it("the passkey then signs into that same account, counting up its uses", async () => {
    const device = new SoftwareAuthenticator(ORIGIN);
    const first = newAgent();
    await register(first, device);
    await first.post("/api/me/primary-person").send({ name: "Pat", colorHex: "#123456" });

    const second = newAgent();
    const res = await signInWithPasskey(second, device, {}, "/world/list");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ redirectTo: "/world/list" });
    expect((await second.get("/api/me")).body.user).toMatchObject({ id: (await first.get("/api/me")).body.user.id, displayName: "Pat" });
    expect((await prisma.passkey.findFirstOrThrow()).signCount).toBe(1);
  });

  it("refuses a passkey this site never registered", async () => {
    const res = await signInWithPasskey(newAgent(), new SoftwareAuthenticator(ORIGIN));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/isn't set up for this site/);
  });

  it("refuses a sign count that goes backwards (a sign the passkey was copied)", async () => {
    const device = new SoftwareAuthenticator(ORIGIN);
    await register(newAgent(), device);
    await signInWithPasskey(newAgent(), device); // count 1
    await signInWithPasskey(newAgent(), device); // count 2
    const res = await signInWithPasskey(newAgent(), device, { counter: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/couldn't be checked/);
  });

  it("refuses an answer made for another site", async () => {
    const res = await register(newAgent(), new SoftwareAuthenticator(ORIGIN), {}, { origin: "https://evil.example" });
    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuses an answer without a live challenge, and a challenge used twice", async () => {
    const device = new SoftwareAuthenticator(ORIGIN);
    const agent = newAgent();
    const options = await agent.post("/api/auth/passkey/register/options");
    const response = device.createResponse(options.body);
    expect((await agent.post("/api/auth/passkey/register/verify").send({ response })).status).toBe(200);
    // The same answer again: its challenge is used up.
    expect((await agent.post("/api/auth/passkey/register/verify").send({ response })).body).toEqual({ error: "That took too long. Try again." });
    // A browser that never asked for options.
    expect((await newAgent().post("/api/auth/passkey/signin/verify").send({ response: {} })).status).toBe(400);
  });

  it("won't use a sign-in challenge to register", async () => {
    const agent = newAgent();
    const options = await agent.post("/api/auth/passkey/signin/options");
    const res = await agent
      .post("/api/auth/passkey/register/verify")
      .send({ response: new SoftwareAuthenticator(ORIGIN).createResponse({ challenge: options.body.challenge, user: { id: "dXNlcg" } }) });
    expect(res.status).toBe(400);
  });
});

describe("Adding a passkey", () => {
  it("adds a named passkey to the signed-in account, which then signs into it", async () => {
    const agent = await signIn("alice");
    const device = new SoftwareAuthenticator(ORIGIN);
    const res = await register(agent, device, { name: "  Alice's phone " });
    expect(res.status).toBe(204);
    expect((await prisma.passkey.findFirstOrThrow()).name).toBe("Alice's phone");

    const other = newAgent();
    await signInWithPasskey(other, device);
    expect((await other.get("/api/me")).body.user.id).toBe((await agent.get("/api/me")).body.user.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("tells the device which passkeys the account already has", async () => {
    const agent = await signIn("alice");
    const device = new SoftwareAuthenticator(ORIGIN);
    await register(agent, device);
    const options = await agent.post("/api/auth/passkey/register/options");
    expect(options.body.excludeCredentials).toEqual([expect.objectContaining({ id: device.id })]);
  });

  it("refuses a name that's empty or over 40 characters", async () => {
    const agent = await signIn("alice");
    for (const name of ["   ", "x".repeat(41)]) {
      const res = await register(agent, new SoftwareAuthenticator(ORIGIN), { name });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Give the passkey a name of 1 to 40 characters.");
    }
    expect(await prisma.passkey.count()).toBe(0);
  });

  it("an add started while signed in can't be finished after signing out", async () => {
    const agent = await signIn("alice");
    const options = await agent.post("/api/auth/passkey/register/options");
    await agent.post("/api/auth/signout");
    const res = await agent.post("/api/auth/passkey/register/verify").send({ response: new SoftwareAuthenticator(ORIGIN).createResponse(options.body) });
    expect(res.status).toBe(401);
    expect(await prisma.passkey.count()).toBe(0);
  });

  it("delete account removes the account's passkeys", async () => {
    const agent = await signIn("alice");
    await register(agent, new SoftwareAuthenticator(ORIGIN));
    await agent.delete("/api/me");
    expect(await prisma.passkey.count()).toBe(0);
  });
});
