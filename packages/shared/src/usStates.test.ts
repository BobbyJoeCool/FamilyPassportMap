import { describe, it, expect } from "vitest";
import { FIPS_TO_USPS, US_STATES, US_STATE_CODES } from "./usStates.js";

describe("US_STATES", () => {
  it("has exactly the 50 states, with no DC or territories", () => {
    expect(US_STATES).toHaveLength(50);
    for (const code of ["DC", "PR", "GU", "VI", "AS", "MP"]) expect(US_STATE_CODES).not.toContain(code);
  });

  it("gives every state a unique two-letter code and a unique name", () => {
    expect(new Set(US_STATE_CODES).size).toBe(50);
    expect(new Set(US_STATES.map((s) => s.name)).size).toBe(50);
    // Each code is checked on its own, so a bad one shows up by value.
    for (const state of US_STATES) {
      expect(state.code).toMatch(/^[A-Z]{2}$/);
      expect(state.name.trim()).not.toBe("");
    }
  });

  it("is in alphabetical order by name (the List page relies on it)", () => {
    const names = US_STATES.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("finds a state by code and by name", () => {
    expect(US_STATES.find((s) => s.code === "WI")?.name).toBe("Wisconsin");
    expect(US_STATES.find((s) => s.name === "New Mexico")?.code).toBe("NM");
  });
});

describe("US_STATE_CODES", () => {
  it("lists every state's code in US_STATES order", () => {
    expect(US_STATE_CODES).toEqual(US_STATES.map((s) => s.code));
  });
});

describe("FIPS_TO_USPS", () => {
  it("maps every state, and only states, from its FIPS code", () => {
    expect(new Set(Object.values(FIPS_TO_USPS))).toEqual(new Set(US_STATE_CODES));
    expect(Object.keys(FIPS_TO_USPS)).toHaveLength(50);
  });

  it("uses zero-padded two-digit FIPS codes, as us-atlas does", () => {
    expect(FIPS_TO_USPS["06"]).toBe("CA");
    expect(FIPS_TO_USPS["6"]).toBeUndefined();
    expect(Object.keys(FIPS_TO_USPS).every((fips) => /^\d{2}$/.test(fips))).toBe(true);
  });

  it("has nothing for DC (11) or Puerto Rico (72)", () => {
    expect(FIPS_TO_USPS["11"]).toBeUndefined();
    expect(FIPS_TO_USPS["72"]).toBeUndefined();
  });
});
