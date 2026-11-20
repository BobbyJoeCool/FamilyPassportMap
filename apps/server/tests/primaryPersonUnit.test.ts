import fs from "node:fs/promises";
import { describe, it, expect, beforeEach } from "vitest";
import type { Actor } from "../src/access.js";
import { prisma } from "../src/db.js";
import { photoFileOnDisk } from "../src/photos.js";
import { claimPerson, createPrimaryPerson, deletePersonUnlessPrimary } from "../src/primaryPerson.js";

// Edge cases of the Primary Person operations that the routes never reach (the route guards
// filter them out first), tested directly.

let alice: Actor;
let bob: Actor;

/**
 * Creates a User straight in the database.
 * @param name - a short name, also used for the subject.
 * @returns the User as an actor.
 */
async function makeUser(name: string): Promise<Actor> {
  const user = await prisma.user.create({
    data: { email: `${name}@example.com`, displayName: name },
  });
  return { userId: user.id };
}

/**
 * Creates a Person owned by the given User.
 * @param owner - the Owner.
 * @param name - the Person's name.
 * @returns the Person.
 */
function makePerson(owner: Actor, name: string) {
  return prisma.person.create({ data: { ownerId: owner.userId, name, colorHex: "#3366cc" } });
}

beforeEach(async () => {
  alice = await makeUser("alice");
  bob = await makeUser("bob");
});

describe("createPrimaryPerson", () => {
  it("creates the Primary Person once, then answers null", async () => {
    const person = await createPrimaryPerson(alice, { name: "Alice", colorHex: "#3366cc" });
    expect(person).toMatchObject({ ownerId: alice.userId });
    expect((await prisma.user.findUnique({ where: { id: alice.userId } }))?.primaryPersonId).toBe(person!.id);
    expect(await createPrimaryPerson(alice, { name: "Again", colorHex: "#3366cc" })).toBeNull();
  });

  it("throws when nobody is signed in", async () => {
    await expect(createPrimaryPerson(null, { name: "X", colorHex: "#3366cc" })).rejects.toThrow("needs a signed-in User");
  });
});

describe("claimPerson", () => {
  it("is notOwned for another User's Person or a missing one, changing nothing", async () => {
    const bobs = await makePerson(bob, "Bob's");
    expect(await claimPerson(alice, bobs.id)).toEqual({ outcome: "notOwned" });
    expect(await claimPerson(alice, "no-such-id")).toEqual({ outcome: "notOwned" });
    expect((await prisma.user.findUnique({ where: { id: alice.userId } }))?.primaryPersonId).toBeNull();
  });

  it("still succeeds when the old Primary Person's photo file is already gone", async () => {
    const old = await createPrimaryPerson(alice, { name: "Old", colorHex: "#3366cc" });
    await prisma.person.update({ where: { id: old!.id }, data: { profilePicturePath: "uploads/missing-file.png" } });
    const target = await makePerson(alice, "Target");
    await expect(fs.access(photoFileOnDisk("uploads/missing-file.png"))).rejects.toThrow();
    expect(await claimPerson(alice, target.id)).toMatchObject({ outcome: "claimed" });
  });

  it("throws when nobody is signed in", async () => {
    await expect(claimPerson(null, "anything")).rejects.toThrow("needs a signed-in User");
  });
});

describe("deletePersonUnlessPrimary", () => {
  it("deletes an ordinary Person along with their visits", async () => {
    const sam = await makePerson(alice, "Sam");
    await prisma.visitedState.create({ data: { personId: sam.id, stateCode: "CA" } });
    expect(await deletePersonUnlessPrimary(alice, sam.id)).toBe("deleted");
    expect(await prisma.visitedState.count({ where: { personId: sam.id } })).toBe(0);
  });

  it("refuses the actor's own Primary Person", async () => {
    const me = await createPrimaryPerson(alice, { name: "Alice", colorHex: "#3366cc" });
    expect(await deletePersonUnlessPrimary(alice, me!.id)).toBe("isPrimary");
    expect(await prisma.person.findUnique({ where: { id: me!.id } })).not.toBeNull();
  });

  it("is notFound for another User's Person or a missing one", async () => {
    const bobs = await makePerson(bob, "Bob's");
    expect(await deletePersonUnlessPrimary(alice, bobs.id)).toBe("notFound");
    expect(await deletePersonUnlessPrimary(alice, "no-such-id")).toBe("notFound");
    expect(await prisma.person.findUnique({ where: { id: bobs.id } })).not.toBeNull();
  });

  it("throws when nobody is signed in", async () => {
    await expect(deletePersonUnlessPrimary(null, "anything")).rejects.toThrow("needs a signed-in User");
  });
});
