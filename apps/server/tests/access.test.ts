import { describe, it, expect, beforeEach } from "vitest";
import type { Request } from "express";
import type { User } from "@prisma/client";
import { MAX_PEOPLE_PER_USER } from "@familypassportmap/shared";
import {
  actorOf,
  adoptLegacyPeople,
  countOwnedPeople,
  createOwnedPerson,
  findEditablePerson,
  findOwnedPerson,
  findViewablePerson,
  findViewablePersonByPhoto,
  listOwnedPeople,
  listViewablePeople,
  signedInActor,
  viewablePeopleWhere,
  type Actor,
} from "../src/access.js";
import { prisma } from "../src/db.js";

// Direct tests of the access policy, beneath the routes (ownership.test.ts covers it through HTTP).

let alice: Actor;
let bob: Actor;

/**
 * Creates a User straight in the database.
 * @param name - a short name, also used for the subject.
 * @returns the User as an actor.
 */
async function makeUser(name: string): Promise<Actor> {
  const user = await prisma.user.create({
    data: { authProvider: "microsoft", authSubject: `sub-${name}`, email: `${name}@example.com`, displayName: name },
  });
  return { userId: user.id };
}

/**
 * Creates a Person straight in the database.
 * @param ownerId - the Owner's User id, or null for a Legacy Person.
 * @param name - the Person's name.
 * @param profilePicturePath - an optional stored photo path.
 * @returns the Person.
 */
function makePerson(ownerId: string | null, name: string, profilePicturePath: string | null = null) {
  return prisma.person.create({ data: { ownerId, name, colorHex: "#3366cc", profilePicturePath } });
}

beforeEach(async () => {
  alice = await makeUser("alice");
  bob = await makeUser("bob");
});

describe("actorOf and signedInActor", () => {
  it("reads the actor from the signed-in request, or null when signed out", () => {
    expect(actorOf({ user: { id: "u1" } as User } as Request)).toEqual({ userId: "u1" });
    expect(actorOf({} as Request)).toBeNull();
  });

  it("signedInActor passes a real actor through and throws for none", () => {
    expect(signedInActor(alice, "op")).toBe(alice);
    expect(() => signedInActor(null, "doThing")).toThrow("doThing needs a signed-in User");
  });
});

describe("viewing and listing", () => {
  it("lists only the actor's own People, oldest first", async () => {
    const first = await makePerson(alice.userId, "First");
    const second = await makePerson(alice.userId, "Second");
    await makePerson(bob.userId, "Bob's");
    await makePerson(null, "Legacy");
    expect((await listViewablePeople(alice)).map((p) => p.id)).toEqual([first.id, second.id]);
  });

  it("matches nothing for nobody signed in, rather than everything", async () => {
    await makePerson(alice.userId, "A");
    await makePerson(null, "Legacy");
    expect(viewablePeopleWhere(null)).toEqual({ id: { in: [] } });
    expect(await listViewablePeople(null)).toEqual([]);
    expect(await listOwnedPeople(null)).toEqual([]);
    expect(await countOwnedPeople(null)).toBe(0);
  });

  it("finds one Person only for its Owner", async () => {
    const person = await makePerson(alice.userId, "A");
    expect((await findViewablePerson(alice, person.id))?.id).toBe(person.id);
    expect(await findViewablePerson(bob, person.id)).toBeNull();
    expect(await findViewablePerson(null, person.id)).toBeNull();
    expect(await findViewablePerson(alice, "no-such-id")).toBeNull();
  });

  it("edit and own follow the same rule today", async () => {
    const person = await makePerson(alice.userId, "A");
    expect((await findEditablePerson(alice, person.id))?.id).toBe(person.id);
    expect((await findOwnedPerson(alice, person.id))?.id).toBe(person.id);
    expect(await findEditablePerson(bob, person.id)).toBeNull();
    expect(await findOwnedPerson(bob, person.id)).toBeNull();
  });

  it("no one can view, edit or own a Legacy Person", async () => {
    const legacy = await makePerson(null, "Legacy");
    for (const actor of [alice, bob, null]) {
      expect(await findViewablePerson(actor, legacy.id)).toBeNull();
      expect(await findEditablePerson(actor, legacy.id)).toBeNull();
    }
  });

  it("finds a photo's Person only for someone who can view that Person", async () => {
    const person = await makePerson(alice.userId, "A", "uploads/a.png");
    expect((await findViewablePersonByPhoto(alice, "uploads/a.png"))?.id).toBe(person.id);
    expect(await findViewablePersonByPhoto(bob, "uploads/a.png")).toBeNull();
    expect(await findViewablePersonByPhoto(alice, "uploads/other.png")).toBeNull();
  });
});

describe("owning and the People cap", () => {
  it("counts and lists only owned People", async () => {
    await makePerson(alice.userId, "A1");
    await makePerson(alice.userId, "A2");
    await makePerson(bob.userId, "B1");
    expect(await countOwnedPeople(alice)).toBe(2);
    expect((await listOwnedPeople(bob)).map((p) => p.name)).toEqual(["B1"]);
  });

  it("creates a Person owned by the actor", async () => {
    const person = await createOwnedPerson(alice, { name: "New", colorHex: "#000000" });
    expect(person).toMatchObject({ ownerId: alice.userId, name: "New" });
  });

  it("refuses with null once the actor owns the maximum", async () => {
    // Fill Alice up to the cap, one Person at a time.
    for (let i = 0; i < MAX_PEOPLE_PER_USER; i++) await makePerson(alice.userId, `P${i}`);
    expect(await createOwnedPerson(alice, { name: "One too many", colorHex: "#000000" })).toBeNull();
    // Bob's allowance is his own.
    expect(await createOwnedPerson(bob, { name: "Fine", colorHex: "#000000" })).not.toBeNull();
  });

  it("throws when nobody is signed in", async () => {
    await expect(createOwnedPerson(null, { name: "X", colorHex: "#000000" })).rejects.toThrow("needs a signed-in User");
  });
});

describe("adoptLegacyPeople", () => {
  it("gives every Legacy Person to the actor, and is a no-op the second time", async () => {
    await makePerson(null, "L1");
    await makePerson(null, "L2");
    const bobs = await makePerson(bob.userId, "Bob's");
    expect(await adoptLegacyPeople(alice)).toBe(2);
    expect(await countOwnedPeople(alice)).toBe(2);
    expect((await prisma.person.findUnique({ where: { id: bobs.id } }))?.ownerId).toBe(bob.userId);
    expect(await adoptLegacyPeople(alice)).toBe(0);
  });

  it("ignores the People cap", async () => {
    // Alice is already at the cap; adoption still takes the Legacy People.
    for (let i = 0; i < MAX_PEOPLE_PER_USER; i++) await makePerson(alice.userId, `P${i}`);
    await makePerson(null, "Legacy");
    expect(await adoptLegacyPeople(alice)).toBe(1);
    expect(await countOwnedPeople(alice)).toBe(MAX_PEOPLE_PER_USER + 1);
  });
});
