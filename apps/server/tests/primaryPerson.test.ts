import { describe, it, expect, beforeEach } from "vitest";
import { completeSignIn, fakeCode, identityFor, newAgent, signIn, type TestAgent } from "./helpers.js";

let alice: TestAgent;

// A freshly signed-in User who hasn't done the welcome step yet.
beforeEach(async () => {
  alice = await signIn("alice");
});

/**
 * Completes the welcome step for a User.
 * @param agent - the signed-in User.
 * @returns the created Primary Person.
 */
async function createPrimaryPerson(agent: TestAgent) {
  const res = await agent.post("/api/me/primary-person").send({ name: "Alice", colorHex: "#aa00aa" });
  expect(res.status).toBe(201);
  return res.body;
}

describe("The Primary Person", () => {
  it("/api/me has no Primary Person until the welcome step creates one", async () => {
    expect((await alice.get("/api/me")).body.primaryPersonId).toBeNull();

    const primary = await createPrimaryPerson(alice);
    expect(primary).toMatchObject({ name: "Alice", colorHex: "#aa00aa", isPrimary: true });
    expect((await alice.get("/api/me")).body.primaryPersonId).toBe(primary.id);
  });

  it("a User can only create one Primary Person", async () => {
    await createPrimaryPerson(alice);
    const second = await alice.post("/api/me/primary-person").send({ name: "Alice 2", colorHex: "#aa00aa" });
    expect(second.status).toBe(409);
  });

  it.each([
    ["a missing name", { colorHex: "#aa00aa" }],
    ["a blank name", { name: "   ", colorHex: "#aa00aa" }],
    ["a missing color", { name: "Alice" }],
    ["a bad color", { name: "Alice", colorHex: "purple" }],
  ])("the welcome step rejects %s", async (_case, body) => {
    expect((await alice.post("/api/me/primary-person").send(body)).status).toBe(400);
    expect((await alice.get("/api/me")).body.primaryPersonId).toBeNull();
  });

  it("the welcome step works even when the User already owns 10 People", async () => {
    // Possible for the User who Adopts Legacy People; here the 10 are added the normal way.
    for (let i = 1; i <= 10; i++) await alice.post("/api/people").send({ name: `P${i}`, colorHex: "#123456" });
    await createPrimaryPerson(alice);
    expect((await alice.get("/api/people")).body).toHaveLength(11);
  });

  it("isPrimary is true only on the User's Primary Person", async () => {
    const primary = await createPrimaryPerson(alice);
    await alice.post("/api/people").send({ name: "Emma", colorHex: "#00aa00" });

    const people = (await alice.get("/api/people")).body as { id: string; isPrimary: boolean }[];
    expect(people.filter((p) => p.isPrimary).map((p) => p.id)).toEqual([primary.id]);
    expect(people).toHaveLength(2);
  });

  it("the Primary Person can't be deleted, but other People still can", async () => {
    const primary = await createPrimaryPerson(alice);
    const emma = (await alice.post("/api/people").send({ name: "Emma", colorHex: "#00aa00" })).body;

    const refused = await alice.delete(`/api/people/${primary.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: "This is you, so it can't be deleted. To remove it, delete your account." });

    expect((await alice.delete(`/api/people/${emma.id}`)).status).toBe(204);
    expect((await alice.get("/api/people")).body.map((p: { id: string }) => p.id)).toEqual([primary.id]);
  });

  it("the Primary Person can be edited like any Person", async () => {
    const primary = await createPrimaryPerson(alice);
    const res = await alice.patch(`/api/people/${primary.id}`).send({ name: "Alice B", colorHex: "#0000ff" });
    expect(res.body).toMatchObject({ name: "Alice B", colorHex: "#0000ff", isPrimary: true });
  });
});

describe("Signing in before and after the welcome step", () => {
  it("a User with no Primary Person is sent to the welcome step, whatever page they asked for", async () => {
    const res = await completeSignIn(newAgent(), fakeCode(identityFor("carol")), "/world/list");
    expect(res.headers.location).toBe("/welcome");
  });

  it("a User who has done the welcome step goes back to the page they asked for", async () => {
    await createPrimaryPerson(alice);
    const res = await completeSignIn(newAgent(), fakeCode(identityFor("alice")), "/world/list");
    expect(res.headers.location).toBe("/world/list");
  });
});
