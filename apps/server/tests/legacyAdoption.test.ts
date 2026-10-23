import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "../src/db.js";
import { completeSignIn, fakeCode, identityFor, newAgent, signIn } from "./helpers.js";

/** More Legacy People than the per-User cap, to prove Adoption ignores it. */
const LEGACY_COUNT = 12;

// The production family's data from before login: People with no Owner.
beforeEach(async () => {
  // One insert per Legacy Person, in order, so their creation order is stable.
  for (let i = 1; i <= LEGACY_COUNT; i++) {
    await prisma.person.create({ data: { name: `Legacy ${i}`, colorHex: "#123456" } });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Legacy data adoption", () => {
  it("the site owner's sign-in Adopts every Legacy Person, even past the 10-People cap", async () => {
    // Different capitalization on each side: the match is case-insensitive.
    vi.stubEnv("LEGACY_DATA_OWNER_EMAIL", "Owner@Example.com");
    const owner = newAgent();
    await completeSignIn(owner, fakeCode(identityFor("owner", { email: "owner@EXAMPLE.com" })));

    const people = (await owner.get("/api/people")).body as { name: string; isPrimary: boolean }[];
    expect(people).toHaveLength(LEGACY_COUNT);
    // Adopted People are ordinary People, not the owner's Primary Person.
    expect(people.every((person) => !person.isPrimary)).toBe(true);
    expect((await owner.get("/api/people/allowance")).body).toEqual({ owned: LEGACY_COUNT, max: 10 });
  });

  it("a different User's sign-in Adopts nothing, and the site owner still gets them all later", async () => {
    vi.stubEnv("LEGACY_DATA_OWNER_EMAIL", "owner@example.com");
    const bob = await signIn("bob");
    expect((await bob.get("/api/people")).body).toEqual([]);

    const owner = await signIn("owner");
    expect((await owner.get("/api/people")).body).toHaveLength(LEGACY_COUNT);
    // And Bob still sees none of them.
    expect((await bob.get("/api/people")).body).toEqual([]);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("with the setting %s, nothing is Adopted and Legacy People stay invisible", async (_label, value) => {
    // undefined stubs the variable as unset (the test environment may otherwise have it).
    vi.stubEnv("LEGACY_DATA_OWNER_EMAIL", value);
    const owner = await signIn("owner");

    expect((await owner.get("/api/people")).body).toEqual([]);
    expect(await prisma.person.count({ where: { ownerId: null } })).toBe(LEGACY_COUNT);
  });

  it("a second sign-in by the site owner changes nothing", async () => {
    vi.stubEnv("LEGACY_DATA_OWNER_EMAIL", "owner@example.com");
    const first = await signIn("owner");
    const before = (await first.get("/api/people")).body;
    // People the owner adds afterwards are theirs already; signing in again must not disturb them.
    await first.post("/api/me/primary-person").send({ name: "Owner", colorHex: "#aa00aa" });

    const again = newAgent();
    const res = await completeSignIn(again, fakeCode(identityFor("owner")));
    expect(res.status).toBe(302);
    const after = (await again.get("/api/people")).body as { id: string }[];
    expect(after).toHaveLength(before.length + 1);
    expect(after.map((person) => person.id)).toEqual(expect.arrayContaining(before.map((p: { id: string }) => p.id)));
  });
});
