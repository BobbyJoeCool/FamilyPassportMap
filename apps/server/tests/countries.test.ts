import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import {
  COUNTRIES,
  COUNTRY_CODES,
  CONTINENTS,
  ISO_NUMERIC_TO_ALPHA2,
} from "@familypassportmap/shared";
import { app } from "../src/app.js";

let personId: string;

beforeEach(async () => {
  const res = await request(app).post("/api/people").send({ name: "Alice", colorHex: "#3366cc" });
  personId = res.body.id;
});

describe("Country reference data", () => {
  it("has exactly 195 countries with unique alpha-2 and numeric codes", () => {
    expect(COUNTRIES).toHaveLength(195);
    expect(new Set(COUNTRY_CODES).size).toBe(195);
    expect(new Set(COUNTRIES.map((c) => c.numericCode)).size).toBe(195);
  });

  it("assigns every country to one of the 6 continents", () => {
    for (const country of COUNTRIES) {
      expect(CONTINENTS).toContain(country.continent);
    }
  });

  it("bridges ISO numeric codes to alpha-2", () => {
    expect(ISO_NUMERIC_TO_ALPHA2["250"]).toBe("FR");
    expect(ISO_NUMERIC_TO_ALPHA2["840"]).toBe("US");
    expect(ISO_NUMERIC_TO_ALPHA2["036"]).toBe("AU");
    // Greenland is a real ISO code but a dependent territory, so deliberately untracked.
    expect(ISO_NUMERIC_TO_ALPHA2["304"]).toBeUndefined();
  });
});

describe("Per-person countries", () => {
  it("GET /api/people/:id/countries returns empty array initially", async () => {
    const res = await request(app).get(`/api/people/${personId}/countries`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("PUT /api/people/:id/countries/:countryCode marks a country visited", async () => {
    const put = await request(app).put(`/api/people/${personId}/countries/FR`);
    expect(put.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/countries`);
    expect(get.body).toEqual(["FR"]);
  });

  it("PUT is idempotent — marking the same country twice succeeds", async () => {
    await request(app).put(`/api/people/${personId}/countries/JP`);
    const res = await request(app).put(`/api/people/${personId}/countries/JP`);
    expect(res.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/countries`);
    expect(get.body).toEqual(["JP"]);
  });

  it("PUT normalizes country code to uppercase", async () => {
    const res = await request(app).put(`/api/people/${personId}/countries/fr`);
    expect(res.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/countries`);
    expect(get.body).toEqual(["FR"]);
  });

  it("PUT rejects invalid country code", async () => {
    const res = await request(app).put(`/api/people/${personId}/countries/ZZ`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown country/i);
  });

  it("PUT rejects a real but untracked territory code", async () => {
    const res = await request(app).put(`/api/people/${personId}/countries/PR`);
    expect(res.status).toBe(400);
  });

  it("PUT returns 404 for nonexistent person", async () => {
    const res = await request(app).put("/api/people/nonexistent/countries/FR");
    expect(res.status).toBe(404);
  });

  it("DELETE /api/people/:id/countries/:countryCode unmarks a country", async () => {
    await request(app).put(`/api/people/${personId}/countries/FR`);

    const del = await request(app).delete(`/api/people/${personId}/countries/FR`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/people/${personId}/countries`);
    expect(get.body).toEqual([]);
  });

  it("DELETE is idempotent — removing an unvisited country succeeds", async () => {
    const res = await request(app).delete(`/api/people/${personId}/countries/BR`);
    expect(res.status).toBe(204);
  });

  it("DELETE returns 404 for nonexistent person", async () => {
    const res = await request(app).delete("/api/people/nonexistent/countries/FR");
    expect(res.status).toBe(404);
  });

  it("GET returns 404 for nonexistent person", async () => {
    const res = await request(app).get("/api/people/nonexistent/countries");
    expect(res.status).toBe(404);
  });

  it("deleting a person cascade-deletes their visited countries", async () => {
    await request(app).put(`/api/people/${personId}/countries/FR`);
    await request(app).delete(`/api/people/${personId}`);

    const res = await request(app).get("/api/countries");
    expect(res.body).toEqual([]);
  });
});

describe("Countries and states are independent", () => {
  it("marking the US as a visited country does not mark any states", async () => {
    await request(app).put(`/api/people/${personId}/countries/US`);

    const states = await request(app).get(`/api/people/${personId}/visits`);
    expect(states.body).toEqual([]);
  });

  it("marking a state does not mark the US as a visited country", async () => {
    await request(app).put(`/api/people/${personId}/visits/CA`);

    const countries = await request(app).get(`/api/people/${personId}/countries`);
    expect(countries.body).toEqual([]);
  });
});

describe("Bulk countries", () => {
  it("GET /api/countries returns empty array with no visits", async () => {
    const res = await request(app).get("/api/countries");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /api/countries groups visited countries by person", async () => {
    const bob = await request(app).post("/api/people").send({ name: "Bob", colorHex: "#00ff00" });

    await request(app).put(`/api/people/${personId}/countries/FR`);
    await request(app).put(`/api/people/${personId}/countries/JP`);
    await request(app).put(`/api/people/${bob.body.id}/countries/BR`);

    const res = await request(app).get("/api/countries");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const aliceCountries = res.body.find((v: { personId: string }) => v.personId === personId);
    const bobCountries = res.body.find((v: { personId: string }) => v.personId === bob.body.id);

    expect(aliceCountries.countryCodes).toHaveLength(2);
    expect(aliceCountries.countryCodes).toContain("FR");
    expect(aliceCountries.countryCodes).toContain("JP");
    expect(bobCountries.countryCodes).toEqual(["BR"]);
  });
});
