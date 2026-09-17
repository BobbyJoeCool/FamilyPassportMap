import { Router } from "express";
import { Prisma } from "@prisma/client";
import { COUNTRY_CODES } from "@familypassportmap/shared";
import { prisma } from "../db.js";

// Mirrors routes/visits.ts endpoint-for-endpoint, for countries instead of US states. The two
// are deliberately independent: nothing here reads or writes VisitedState.

// --- Bulk countries router: mounted at /api/countries in app.ts ---

/** Router for `/api/countries` — read-only, all people's visited countries in one call. */
export const bulkCountriesRouter = Router();

/**
 * `GET /api/countries` — every person's visited countries in one response, used by the
 * World Compare and World List views so they don't have to make one request per person.
 */
bulkCountriesRouter.get("/", async (_req, res) => {
  const rows = await prisma.visitedCountry.findMany({
    select: { personId: true, countryCode: true },
    orderBy: { personId: "asc" },
  });

  // Group the flat (personId, countryCode) rows into one entry per person, each holding
  // that person's full list of visited country codes.
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    let codes = grouped.get(row.personId);
    // First time we've seen this person — start a new list and register it in the map
    // before appending to it below.
    if (!codes) {
      codes = [];
      grouped.set(row.personId, codes);
    }
    codes.push(row.countryCode);
  }

  const result = Array.from(grouped, ([personId, countryCodes]) => ({ personId, countryCodes }));
  res.json(result);
});

// --- Per-person countries router: mounted at /api/people/:id/countries in app.ts ---

/** Router for `/api/people/:id/countries` — one person's visited countries. */
export const countriesRouter = Router({ mergeParams: true });

/**
 * Checks whether a person with the given id exists.
 * @param id - the person's id.
 * @returns true if a matching person row exists.
 */
async function personExists(id: string): Promise<boolean> {
  const person = await prisma.person.findUnique({ where: { id }, select: { id: true } });
  return person !== null;
}

/** `GET /api/people/:id/countries` — list one person's visited country codes. */
countriesRouter.get("/", async (req, res) => {
  const { id } = req.params as { id: string };
  // Distinguish "no countries" from "no such person" — the latter is a 404, not an empty list.
  if (!(await personExists(id))) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const rows = await prisma.visitedCountry.findMany({
    where: { personId: id },
    select: { countryCode: true },
  });
  res.json(rows.map((row) => row.countryCode));
});

/** `PUT /api/people/:id/countries/:countryCode` — mark a country visited for a person. */
countriesRouter.put("/:countryCode", async (req, res) => {
  const { id, countryCode } = req.params as { id: string; countryCode: string };
  const normalized = countryCode.toUpperCase();
  // Reject anything that isn't one of the 195 tracked ISO 3166-1 alpha-2 codes — this also
  // rejects real-but-untracked codes like dependent territories ("PR", "GL").
  if (!COUNTRY_CODES.includes(normalized)) {
    res.status(400).json({ error: "Unknown country code" });
    return;
  }

  try {
    // Idempotent: upsert so calling this twice for the same country is a no-op, not an error.
    await prisma.visitedCountry.upsert({
      where: { personId_countryCode: { personId: id, countryCode: normalized } },
      create: { personId: id, countryCode: normalized },
      update: {},
    });
    res.status(204).end();
  } catch (error) {
    // P2003 = foreign key violation — the referenced person doesn't exist.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    throw error;
  }
});

/** `DELETE /api/people/:id/countries/:countryCode` — unmark a country as visited for a person. */
countriesRouter.delete("/:countryCode", async (req, res) => {
  const { id, countryCode } = req.params as { id: string; countryCode: string };
  // Distinguish "no such person" (404) from "country wasn't marked visited" (still a no-op 204).
  if (!(await personExists(id))) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  await prisma.visitedCountry.deleteMany({
    where: { personId: id, countryCode: countryCode.toUpperCase() },
  });
  res.status(204).end();
});
