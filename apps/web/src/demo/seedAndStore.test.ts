import { describe, expect, it } from "vitest";
import { COUNTRIES, COUNTRY_CODES, CONTINENTS, hexColorSchema, US_STATE_CODES } from "@familypassportmap/shared";
import { DEMO_SEED, stampAvatarSvg } from "./seed";
import { createStore } from "./store";

describe("the demo seed", () => {
  it("has four People with distinct names and hex colors", () => {
    expect(DEMO_SEED.people.map((person) => person.name)).toEqual(["Homer", "Marge", "Bart", "Lisa"]);
    const colors = DEMO_SEED.people.map((person) => person.colorHex);
    // Every color passes the same rule the API enforces, and no two People share one.
    for (const color of colors) expect(hexColorSchema.safeParse(color).success).toBe(true);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("has exactly one Primary Person, Homer", () => {
    expect(DEMO_SEED.people.filter((person) => person.isPrimary).map((person) => person.name)).toEqual(["Homer"]);
  });

  it("uses only real state and country codes, with no repeats", () => {
    // Each Person's codes must exist in the shared reference data and be unique for them.
    for (const person of DEMO_SEED.people) {
      for (const code of person.states) expect(US_STATE_CODES).toContain(code);
      for (const code of person.countries) expect(COUNTRY_CODES).toContain(code);
      expect(new Set(person.states).size).toBe(person.states.length);
      expect(new Set(person.countries).size).toBe(person.countries.length);
    }
  });

  it("gives You about 20 states and 8 countries, and everyone else fewer", () => {
    const [you, ...others] = DEMO_SEED.people;
    expect(you.states).toHaveLength(20);
    expect(you.countries).toHaveLength(8);
    // Nobody out-travels "You", so the US map opens on the fullest map.
    for (const other of others) {
      expect(other.states.length).toBeLessThan(you.states.length);
      expect(other.countries.length).toBeLessThan(you.countries.length);
    }
  });

  it("covers every continent between them, with overlap for Compare", () => {
    const continentOf = new Map(COUNTRIES.map((country) => [country.code, country.continent]));
    const visited = new Set(DEMO_SEED.people.flatMap((person) => person.countries.map((code) => continentOf.get(code))));
    expect([...visited].sort()).toEqual([...CONTINENTS].sort());
    // At least one state that everyone has visited.
    const [first, ...rest] = DEMO_SEED.people;
    expect(first.states.some((code) => rest.every((person) => person.states.includes(code)))).toBe(true);
  });

  it("bundles only original SVG avatars", () => {
    const photos = DEMO_SEED.people.flatMap((person) => (person.photo ? [person.photo] : []));
    expect(photos.length).toBeGreaterThan(0);
    for (const photo of photos) {
      expect(photo.type).toBe("image/svg+xml");
      expect(photo.contents.startsWith("<svg")).toBe(true);
    }
    expect(stampAvatarSvg("Q", "#123456")).toContain(">Q</text>");
  });
});

describe("createStore", () => {
  it("loads the seed with Homer as You and photos in the photo store", () => {
    const store = createStore(DEMO_SEED);
    expect(store.people.map((person) => person.name)).toEqual(["Homer", "Marge", "Bart", "Lisa"]);
    expect(store.people.find((person) => person.id === store.primaryPersonId)?.name).toBe("Homer");
    const marge = store.people[1];
    expect(marge.profilePicturePath).toBe("uploads/demo-seed-marge.svg");
    expect(store.photos.get("demo-seed-marge.svg")?.type).toBe("image/svg+xml");
    expect([...store.states.get(store.primaryPersonId)!]).toHaveLength(20);
  });

  it("lists the seed oldest first with distinct times", () => {
    const times = createStore(DEMO_SEED).people.map((person) => Date.parse(person.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
  });

  it("starts over: a new store doesn't see changes made to an old one", () => {
    const first = createStore(DEMO_SEED);
    first.people.pop();
    first.states.get(first.primaryPersonId)!.clear();
    first.photos.clear();

    const second = createStore(DEMO_SEED);
    expect(second.people).toHaveLength(4);
    expect(second.states.get(second.primaryPersonId)!.size).toBe(20);
    expect(second.photos.size).toBe(2);
    // The seed itself is untouched too.
    expect(DEMO_SEED.people[0].states).toHaveLength(20);
  });

  it("refuses a seed without exactly one Primary Person", () => {
    const person = { name: "A", colorHex: "#000000", states: [], countries: [] };
    expect(() => createStore({ people: [person] })).toThrow(/exactly one Primary Person/);
    expect(() =>
      createStore({ people: [{ ...person, isPrimary: true }, { ...person, isPrimary: true }] }),
    ).toThrow(/found 2/);
  });
});
