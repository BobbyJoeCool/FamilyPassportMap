import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { prisma } from "../src/db.js";
import { signIn, type TestAgent } from "./helpers.js";

let alice: TestAgent;
let defaultPrimaryId: string;
let olderSelfId: string;

/**
 * Marks states and countries visited for a Person.
 * @param agent - the Person's Owner.
 * @param personId - the Person.
 * @param states - USPS state codes to mark.
 * @param countries - ISO country codes to mark.
 */
async function markVisits(agent: TestAgent, personId: string, states: string[], countries: string[]): Promise<void> {
  // One request per code, in order, so every mark has landed before the test continues.
  for (const code of states) await agent.put(`/api/people/${personId}/visits/${code}`);
  for (const code of countries) await agent.put(`/api/people/${personId}/countries/${code}`);
}

/**
 * Reads a Person's visited state and country codes, sorted.
 * @param agent - a User who can view the Person.
 * @param personId - the Person.
 * @returns their states and countries.
 */
async function visitsOf(agent: TestAgent, personId: string) {
  const states = (await agent.get(`/api/people/${personId}/visits`)).body as string[];
  const countries = (await agent.get(`/api/people/${personId}/countries`)).body as string[];
  return { states: [...states].sort(), countries: [...countries].sort() };
}

// Alice finished the welcome step (her default Primary Person), but she had also added
// herself earlier as an ordinary Person ("Alice (earlier)") with her real travel history.
beforeEach(async () => {
  alice = await signIn("alice");
  defaultPrimaryId = (await alice.post("/api/me/primary-person").send({ name: "Alice", colorHex: "#aa00aa" })).body.id;
  olderSelfId = (await alice.post("/api/people").send({ name: "Alice (earlier)", colorHex: "#0000aa" })).body.id;
  await markVisits(alice, defaultPrimaryId, ["TX", "WA"], ["JP"]);
  await markVisits(alice, olderSelfId, ["TX", "CA"], ["FR"]);
});

describe("Set as me (Claiming one of your own People)", () => {
  it("merges the old Primary Person's visits into the Claimed Person", async () => {
    const res = await alice.post(`/api/people/${olderSelfId}/claim`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: olderSelfId, name: "Alice (earlier)", isPrimary: true });

    expect(await visitsOf(alice, olderSelfId)).toEqual({ states: ["CA", "TX", "WA"], countries: ["FR", "JP"] });
  });

  it("visits the Claimed Person already had keep their dates; copied visits keep theirs too", async () => {
    // Visit dates aren't part of the API, so this check reads the database directly.
    const before = await prisma.visitedState.findMany({ where: { stateCode: { in: ["TX", "WA"] } } });
    const targetTx = before.find((row) => row.personId === olderSelfId && row.stateCode === "TX")!;
    const oldWa = before.find((row) => row.personId === defaultPrimaryId && row.stateCode === "WA")!;

    await alice.post(`/api/people/${olderSelfId}/claim`);

    const after = await prisma.visitedState.findMany({ where: { personId: olderSelfId } });
    expect(after.find((row) => row.stateCode === "TX")!.visitedAt).toEqual(targetTx.visitedAt);
    expect(after.find((row) => row.stateCode === "WA")!.visitedAt).toEqual(oldWa.visitedAt);
  });

  it("the old Primary Person is gone, /api/me points at the Claimed Person, and the count drops by one", async () => {
    expect((await alice.get("/api/people/allowance")).body.owned).toBe(2);

    await alice.post(`/api/people/${olderSelfId}/claim`);

    const people = (await alice.get("/api/people")).body as { id: string; isPrimary: boolean }[];
    expect(people.map((p) => [p.id, p.isPrimary])).toEqual([[olderSelfId, true]]);
    expect((await alice.get("/api/me")).body.primaryPersonId).toBe(olderSelfId);
    expect((await alice.get("/api/people/allowance")).body.owned).toBe(1);
    expect((await alice.get(`/api/people/${defaultPrimaryId}/visits`)).status).toBe(404);
  });

  it("the old Primary Person's photo file is removed", async () => {
    const image = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#00f" } }).png().toBuffer();
    const photoPath = (await alice.post(`/api/people/${defaultPrimaryId}/photo`).attach("photo", image, "me.png")).body
      .profilePicturePath;
    expect((await alice.get(`/${photoPath}`)).status).toBe(200);

    await alice.post(`/api/people/${olderSelfId}/claim`);

    expect((await alice.get(`/${photoPath}`)).status).toBe(404);
  });

  it("Claiming your current Primary Person is refused and changes nothing", async () => {
    const res = await alice.post(`/api/people/${defaultPrimaryId}/claim`);
    expect(res.status).toBe(409);
    expect((await alice.get("/api/people")).body).toHaveLength(2);
  });

  it("Claiming another User's Person is a 404 and changes nothing", async () => {
    const bob = await signIn("bob");
    const res = await bob.post(`/api/people/${olderSelfId}/claim`);
    expect(res.status).toBe(404);
    expect((await alice.get("/api/me")).body.primaryPersonId).toBe(defaultPrimaryId);
  });

  it("a User without a Primary Person yet can Claim one of their People directly", async () => {
    const carol = await signIn("carol");
    const carolSelf = (await carol.post("/api/people").send({ name: "Carol", colorHex: "#00aaaa" })).body.id;

    const res = await carol.post(`/api/people/${carolSelf}/claim`);
    expect(res.status).toBe(200);
    expect((await carol.get("/api/me")).body.primaryPersonId).toBe(carolSelf);
  });
});
