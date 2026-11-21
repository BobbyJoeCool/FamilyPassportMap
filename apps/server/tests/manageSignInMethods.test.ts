import { describe, expect, it } from "vitest";
import { LAST_METHOD_MESSAGE } from "@familypassportmap/shared";
import { prisma } from "../src/db.js";
import { completeProviderRoundTrip, newAgent, providerCode, signIn, type TestAgent } from "./helpers.js";
import { SoftwareAuthenticator } from "./softwareAuthenticator.js";

// The signed-in User's Sign-in methods: list, remove (never the last), rename a passkey.

/**
 * Adds a passkey to the agent's account.
 * @param agent - a signed-in agent.
 * @param name - the passkey's name.
 */
async function addPasskey(agent: TestAgent, name: string): Promise<void> {
  const options = await agent.post("/api/auth/passkey/register/options");
  const res = await agent
    .post("/api/auth/passkey/register/verify")
    .send({ response: new SoftwareAuthenticator("http://localhost:5173").createResponse(options.body), name });
  expect(res.status).toBe(204);
}

/**
 * The agent's sign-in methods.
 * @param agent - a signed-in agent.
 * @returns the list from the API.
 */
async function methodsOf(agent: TestAgent) {
  const res = await agent.get("/api/me/sign-in-methods");
  expect(res.status).toBe(200);
  return res.body.methods as Array<{ id: string; kind: string; label: string; createdAt: string; lastUsedAt: string }>;
}

describe("Listing sign-in methods", () => {
  it("shows every kind, oldest first, with labels and dates", async () => {
    const agent = await signIn("alice");
    await completeProviderRoundTrip(agent, "github", providerCode({ subject: "gh", email: null, name: "A", avatarUrl: null }), "add");
    await addPasskey(agent, "Alice's phone");

    const methods = await methodsOf(agent);
    expect(methods.map(({ kind, label }) => ({ kind, label }))).toEqual([
      { kind: "microsoft", label: "alice@example.com" },
      { kind: "github", label: "GitHub account" },
      { kind: "passkey", label: "Alice's phone" },
    ]);
    for (const method of methods) {
      expect(new Date(method.createdAt).toISOString()).toBe(method.createdAt);
      expect(new Date(method.lastUsedAt).toISOString()).toBe(method.lastUsedAt);
    }
  });

  it("needs a signed-in User", async () => {
    expect((await newAgent().get("/api/me/sign-in-methods")).status).toBe(401);
  });
});

describe("Removing sign-in methods", () => {
  it("removes one while others remain, and refuses the last one", async () => {
    const agent = await signIn("alice");
    await addPasskey(agent, "Phone");
    const [microsoft, passkey] = await methodsOf(agent);

    expect((await agent.delete(`/api/me/sign-in-methods/${microsoft.id}`)).status).toBe(204);
    const last = await agent.delete(`/api/me/sign-in-methods/${passkey.id}`);
    expect(last.status).toBe(409);
    expect(last.body).toEqual({ error: LAST_METHOD_MESSAGE });
    expect((await methodsOf(agent)).map((method) => method.kind)).toEqual(["passkey"]);
  });

  it("a removed provider account no longer signs into this account", async () => {
    const agent = await signIn("alice");
    const google = providerCode({ subject: "g-alice", email: "a@g.com", name: "Alice", avatarUrl: null });
    await completeProviderRoundTrip(agent, "google", google, "add");
    const googleMethod = (await methodsOf(agent)).find((method) => method.kind === "google")!;
    await agent.delete(`/api/me/sign-in-methods/${googleMethod.id}`);

    // Signing in with that Google account now makes a separate, new account.
    const other = newAgent();
    await completeProviderRoundTrip(other, "google", google);
    expect((await other.get("/api/me")).body.user.id).not.toBe((await agent.get("/api/me")).body.user.id);
  });

  it("another User's method is not found, and stays", async () => {
    const bob = await signIn("bob");
    await addPasskey(bob, "Bob's");
    const [bobsMicrosoft] = await methodsOf(bob);
    const alice = await signIn("alice");
    const res = await alice.delete(`/api/me/sign-in-methods/${bobsMicrosoft.id}`);
    expect(res.status).toBe(404);
    expect(await prisma.signInMethod.count({ where: { id: bobsMicrosoft.id } })).toBe(1);
  });
});

describe("Renaming a passkey", () => {
  it("renames the User's own passkey, trimmed", async () => {
    const agent = await signIn("alice");
    await addPasskey(agent, "Old");
    const passkey = (await methodsOf(agent)).find((method) => method.kind === "passkey")!;
    const res = await agent.patch(`/api/me/passkeys/${passkey.id}`).send({ name: "  New name " });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: passkey.id, kind: "passkey", label: "New name" });
  });

  it("refuses a bad name, and another User's passkey", async () => {
    const bob = await signIn("bob");
    await addPasskey(bob, "Bob's");
    const bobsPasskey = (await methodsOf(bob)).find((method) => method.kind === "passkey")!;
    expect((await bob.patch(`/api/me/passkeys/${bobsPasskey.id}`).send({ name: "" })).status).toBe(400);
    expect((await bob.patch(`/api/me/passkeys/${bobsPasskey.id}`).send({ name: "x".repeat(41) })).status).toBe(400);

    const alice = await signIn("alice");
    expect((await alice.patch(`/api/me/passkeys/${bobsPasskey.id}`).send({ name: "Mine" })).status).toBe(404);
    // A provider method's id isn't a passkey.
    const [alicesMicrosoft] = await methodsOf(alice);
    expect((await alice.patch(`/api/me/passkeys/${alicesMicrosoft.id}`).send({ name: "Mine" })).status).toBe(404);
  });
});
