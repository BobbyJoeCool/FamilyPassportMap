import { describe, it, expect } from "vitest";
import {
  CONTINENTS,
  COUNTRIES,
  COUNTRY_CODES,
  ISO_NUMERIC_TO_ALPHA2,
  countriesByContinent,
  type Continent,
} from "./countries.js";

describe("COUNTRIES", () => {
  it("has the 193 UN members plus the 2 observer states", () => {
    expect(COUNTRIES).toHaveLength(195);
  });

  it("gives every country a unique alpha-2, alpha-3 and numeric code", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.alpha3)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.numericCode)).size).toBe(COUNTRIES.length);
  });

  it("uses uppercase ISO code formats", () => {
    // Every entry is checked, so one malformed row fails the test with its own values.
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.alpha3).toMatch(/^[A-Z]{3}$/);
      expect(country.numericCode).toMatch(/^\d{3}$/);
    }
  });

  it("gives every country a display name and one of the six continents", () => {
    // Same: report the exact country whose name or continent is wrong.
    for (const country of COUNTRIES) {
      expect(country.name.trim()).not.toBe("");
      expect(CONTINENTS).toContain(country.continent);
    }
  });

  it("is in alphabetical order by name, so continent slices need no sorting", () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("keeps the documented continent decisions from the Phase 8 spec", () => {
    const continentOf = (code: string) => COUNTRIES.find((c) => c.code === code)?.continent;
    expect(continentOf("RU")).toBe("Europe");
    expect(continentOf("TR")).toBe("Asia");
    expect(continentOf("CY")).toBe("Europe");
    expect(continentOf("EG")).toBe("Africa");
    expect(continentOf("TL")).toBe("Asia");
    expect(continentOf("JM")).toBe("North America");
  });

  it("includes the observer states but no dependent territories", () => {
    expect(COUNTRY_CODES).toContain("VA");
    expect(COUNTRY_CODES).toContain("PS");
    // Greenland, Puerto Rico, Taiwan and Kosovo are deliberately untracked.
    for (const code of ["GL", "PR", "TW", "XK"]) expect(COUNTRY_CODES).not.toContain(code);
  });
});

describe("COUNTRY_CODES", () => {
  it("lists every country's alpha-2 code in COUNTRIES order", () => {
    expect(COUNTRY_CODES).toEqual(COUNTRIES.map((c) => c.code));
  });
});

describe("ISO_NUMERIC_TO_ALPHA2", () => {
  it("maps a numeric code to its alpha-2 code", () => {
    expect(ISO_NUMERIC_TO_ALPHA2["250"]).toBe("FR");
    expect(ISO_NUMERIC_TO_ALPHA2["840"]).toBe("US");
  });

  it("keeps the leading zeros world-atlas uses", () => {
    expect(ISO_NUMERIC_TO_ALPHA2["004"]).toBe("AF");
    expect(ISO_NUMERIC_TO_ALPHA2["4"]).toBeUndefined();
  });

  it("has nothing for an untracked numeric id (Taiwan, 158)", () => {
    expect(ISO_NUMERIC_TO_ALPHA2["158"]).toBeUndefined();
  });

  it("has exactly one entry per country", () => {
    expect(Object.keys(ISO_NUMERIC_TO_ALPHA2)).toHaveLength(COUNTRIES.length);
  });
});

describe("countriesByContinent", () => {
  it("returns only that continent's countries, alphabetical", () => {
    const europe = countriesByContinent("Europe");
    expect(europe.length).toBeGreaterThan(0);
    expect(europe.every((c) => c.continent === "Europe")).toBe(true);
    expect(europe.map((c) => c.name)).toEqual([...europe.map((c) => c.name)].sort((a, b) => a.localeCompare(b)));
  });

  it("splits every country into exactly one continent", () => {
    // Sum each continent's slice: together they must cover the whole list once.
    const total = CONTINENTS.reduce((sum, continent) => sum + countriesByContinent(continent).length, 0);
    expect(total).toBe(COUNTRIES.length);
  });

  it("returns an empty list for a continent that isn't tracked", () => {
    expect(countriesByContinent("Antarctica" as Continent)).toEqual([]);
  });
});
