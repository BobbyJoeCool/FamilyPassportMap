import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { prisma } from "../src/db.js";
import { signIn, type TestAgent } from "./helpers.js";

let alice: TestAgent;
let bob: TestAgent;
let alicesPersonId: string;

/**
 * Adds People for a User until they own `total` (they already own `alreadyOwned`).
 * @param agent - the signed-in User.
 * @param alreadyOwned - how many People they own now.
 * @param total - how many they should own afterwards.
 */
async function addPeopleUpTo(agent: TestAgent, alreadyOwned: number, total: number): Promise<void> {
  // One request at a time, so the count is exact when this returns.
  for (let i = alreadyOwned + 1; i <= total; i++) {
    expect((await agent.post("/api/people").send({ name: `Person ${i}`, colorHex: "#123456" })).status).toBe(201);
  }
}

// Two Users, each signed in; Alice owns one Person with a visited state and country.
beforeEach(async () => {
  alice = await signIn("alice");
  bob = await signIn("bob");
  const created = await alice.post("/api/people").send({ name: "Emma", colorHex: "#ff0000" });
  alicesPersonId = created.body.id;
  await alice.put(`/api/people/${alicesPersonId}/visits/CA`);
  await alice.put(`/api/people/${alicesPersonId}/countries/FR`);
});

describe("Each User sees only the People they own", () => {
  it("another User's People don't appear in the People list", async () => {
    expect((await bob.get("/api/people")).body).toEqual([]);
    expect((await alice.get("/api/people")).body.map((p: { name: string }) => p.name)).toEqual(["Emma"]);
  });

  it.each([
    ["read Emma's visits", (id: string) => bob.get(`/api/people/${id}/visits`)],
    ["read Emma's countries", (id: string) => bob.get(`/api/people/${id}/countries`)],
    ["rename Emma", (id: string) => bob.patch(`/api/people/${id}`).send({ name: "Hacked" })],
    ["delete Emma", (id: string) => bob.delete(`/api/people/${id}`)],
    ["mark a state for Emma", (id: string) => bob.put(`/api/people/${id}/visits/TX`)],
    ["unmark Emma's state", (id: string) => bob.delete(`/api/people/${id}/visits/CA`)],
    ["mark a country for Emma", (id: string) => bob.put(`/api/people/${id}/countries/DE`)],
    ["unmark Emma's country", (id: string) => bob.delete(`/api/people/${id}/countries/FR`)],
  ])("another User can't %s (404, as if Emma didn't exist)", async (_action, attempt) => {
    const res = await attempt(alicesPersonId);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Person not found" });
  });

  it("another User can't upload a photo for someone else's Person", async () => {
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer();
    const res = await bob.post(`/api/people/${alicesPersonId}/photo`).attach("photo", image, "x.png");
    expect(res.status).toBe(404);
  });

  it("nothing another User tries changes the Owner's data", async () => {
    await bob.patch(`/api/people/${alicesPersonId}`).send({ name: "Hacked" });
    await bob.put(`/api/people/${alicesPersonId}/visits/TX`);
    await bob.delete(`/api/people/${alicesPersonId}/visits/CA`);
    await bob.delete(`/api/people/${alicesPersonId}`);

    expect((await alice.get("/api/people")).body[0].name).toBe("Emma");
    expect((await alice.get(`/api/people/${alicesPersonId}/visits`)).body).toEqual(["CA"]);
  });

  it("bulk visit maps include only the User's own People", async () => {
    expect((await bob.get("/api/visits")).body).toEqual([]);
    expect((await bob.get("/api/countries")).body).toEqual([]);
    expect((await alice.get("/api/visits")).body).toEqual([{ personId: alicesPersonId, stateCodes: ["CA"] }]);
    expect((await alice.get("/api/countries")).body).toEqual([{ personId: alicesPersonId, countryCodes: ["FR"] }]);
  });

  it("People with no Owner (pre-login data) are visible to no one", async () => {
    // Pre-login People can't be created through the API any more, so this one is inserted
    // directly, exactly as the migration leaves existing rows.
    const legacy = await prisma.person.create({ data: { name: "Legacy", colorHex: "#00ff00" } });

    expect((await alice.get("/api/people")).body.map((p: { name: string }) => p.name)).toEqual(["Emma"]);
    expect((await bob.get(`/api/people/${legacy.id}/visits`)).status).toBe(404);
  });
});

describe("Each User can own at most 10 People", () => {
  it("the 10th Person is allowed and the 11th is refused with the cap message", async () => {
    // Alice already owns Emma (from beforeEach); add 9 more to reach 10.
    await addPeopleUpTo(alice, 1, 10);

    const eleventh = await alice.post("/api/people").send({ name: "One too many", colorHex: "#123456" });
    expect(eleventh.status).toBe(409);
    expect(eleventh.body).toEqual({ error: "You can have up to 10 people, including yourself." });
    expect((await alice.get("/api/people")).body).toHaveLength(10);
  });

  it("the cap counts only the User's own People", async () => {
    // Alice's 10 People don't use up Bob's allowance.
    await addPeopleUpTo(alice, 1, 10);
    expect((await bob.post("/api/people").send({ name: "Bob's first", colorHex: "#654321" })).status).toBe(201);
  });

  it("People added at the same moment can't take a User past 10", async () => {
    await addPeopleUpTo(alice, 1, 9);

    // Five adds racing for the last free place: exactly one may win.
    const statuses = (
      await Promise.all(
        [1, 2, 3, 4, 5].map((n) => alice.post("/api/people").send({ name: `Racer ${n}`, colorHex: "#123456" })),
      )
    ).map((res) => res.status);

    expect(statuses.sort()).toEqual([201, 409, 409, 409, 409]);
    expect((await alice.get("/api/people")).body).toHaveLength(10);
  });

  it("GET /api/people/allowance reports how many People the User owns and the cap", async () => {
    expect((await alice.get("/api/people/allowance")).body).toEqual({ owned: 1, max: 10 });
    expect((await bob.get("/api/people/allowance")).body).toEqual({ owned: 0, max: 10 });

    await addPeopleUpTo(alice, 1, 10);
    expect((await alice.get("/api/people/allowance")).body).toEqual({ owned: 10, max: 10 });
  });
});
