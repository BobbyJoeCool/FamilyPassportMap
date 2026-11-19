import { describe, it, expect } from "vitest";
import { jsonResponse, mockFetch } from "../test/api";
import { getAllVisits, getVisitedStates, markVisited, unmarkVisited } from "./visits";
import { getAllCountries, getVisitedCountries, markCountryVisited, unmarkCountryVisited } from "./countries";

describe("state visits API", () => {
  it("fetches everyone's visits with GET /api/visits", async () => {
    const visits = [{ personId: "p1", stateCodes: ["CA"] }];
    mockFetch({ "GET /api/visits": visits });
    await expect(getAllVisits()).resolves.toEqual(visits);
  });

  it("fetches one Person's states", async () => {
    const { calls } = mockFetch({ "GET /api/people/p1/visits": ["CA", "NY"] });
    await expect(getVisitedStates("p1")).resolves.toEqual(["CA", "NY"]);
    expect(calls[0].url).toBe("/api/people/p1/visits");
  });

  it("marks with PUT and unmarks with DELETE on the state's path", async () => {
    const { calls } = mockFetch({
      "PUT /api/people/p1/visits/TX": jsonResponse(204),
      "DELETE /api/people/p1/visits/TX": jsonResponse(204),
    });
    await markVisited("p1", "TX");
    await unmarkVisited("p1", "TX");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["PUT /api/people/p1/visits/TX", "DELETE /api/people/p1/visits/TX"]);
  });

  it("rejects when the server refuses", async () => {
    mockFetch({ "PUT /api/people/p1/visits/ZZ": jsonResponse(400, { error: "Unknown state code" }) });
    await expect(markVisited("p1", "ZZ")).rejects.toThrow("Unknown state code");
  });
});

describe("country visits API", () => {
  it("fetches everyone's countries with GET /api/countries", async () => {
    const countries = [{ personId: "p1", countryCodes: ["FR"] }];
    mockFetch({ "GET /api/countries": countries });
    await expect(getAllCountries()).resolves.toEqual(countries);
  });

  it("fetches one Person's countries", async () => {
    mockFetch({ "GET /api/people/p1/countries": ["FR"] });
    await expect(getVisitedCountries("p1")).resolves.toEqual(["FR"]);
  });

  it("marks with PUT and unmarks with DELETE on the country's path", async () => {
    const { calls } = mockFetch({
      "PUT /api/people/p1/countries/JP": jsonResponse(204),
      "DELETE /api/people/p1/countries/JP": jsonResponse(204),
    });
    await markCountryVisited("p1", "JP");
    await unmarkCountryVisited("p1", "JP");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "PUT /api/people/p1/countries/JP",
      "DELETE /api/people/p1/countries/JP",
    ]);
  });
});
