import { Router } from "express";
import { US_STATE_CODES } from "@familypassportmap/shared";
import { actorOf, requireEditablePerson, requireViewablePerson, viewablePeopleWhere } from "../access.js";
import { prisma } from "../db.js";

// --- Bulk visits router: mounted at /api/visits in index.ts ---

/** Router for `/api/visits` — read-only, all people's visited states in one call. */
export const bulkVisitsRouter = Router();

/**
 * `GET /api/visits` — every person's visited states in one response, used by the
 * Compare and List views so they don't have to make one request per person.
 */
bulkVisitsRouter.get("/", async (req, res) => {
  const rows = await prisma.visitedState.findMany({
    // Only rows belonging to People the actor may view.
    where: { person: viewablePeopleWhere(actorOf(req)) },
    select: { personId: true, stateCode: true },
    orderBy: { personId: "asc" },
  });

  // Group the flat (personId, stateCode) rows into one entry per person, each holding
  // that person's full list of visited state codes.
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    let codes = grouped.get(row.personId);
    // First time we've seen this person — start a new list and register it in the map
    // before appending to it below.
    if (!codes) {
      codes = [];
      grouped.set(row.personId, codes);
    }
    codes.push(row.stateCode);
  }

  const result = Array.from(grouped, ([personId, stateCodes]) => ({ personId, stateCodes }));
  res.json(result);
});

// --- Per-person visits router: mounted at /api/people/:id/visits in index.ts ---

/** Router for `/api/people/:id/visits` — one person's visited states. */
export const visitsRouter = Router({ mergeParams: true });

/** `GET /api/people/:id/visits` — list one person's visited state codes. */
visitsRouter.get("/", requireViewablePerson, async (req, res) => {
  const { id } = req.params as { id: string };

  const rows = await prisma.visitedState.findMany({
    where: { personId: id },
    select: { stateCode: true },
  });
  res.json(rows.map((row) => row.stateCode));
});

/** `PUT /api/people/:id/visits/:stateCode` — mark a state visited for a person. */
visitsRouter.put("/:stateCode", requireEditablePerson, async (req, res) => {
  const { id, stateCode } = req.params as { id: string; stateCode: string };
  const normalized = stateCode.toUpperCase();
  // Reject anything that isn't one of the 50 known USPS state codes.
  if (!US_STATE_CODES.includes(normalized)) {
    res.status(400).json({ error: "Unknown state code" });
    return;
  }

  // Idempotent: upsert so calling this twice for the same state is a no-op, not an error.
  await prisma.visitedState.upsert({
    where: { personId_stateCode: { personId: id, stateCode: normalized } },
    create: { personId: id, stateCode: normalized },
    update: {},
  });
  res.status(204).end();
});

/** `DELETE /api/people/:id/visits/:stateCode` — unmark a state as visited for a person. */
visitsRouter.delete("/:stateCode", requireEditablePerson, async (req, res) => {
  const { id, stateCode } = req.params as { id: string; stateCode: string };

  await prisma.visitedState.deleteMany({
    where: { personId: id, stateCode: stateCode.toUpperCase() },
  });
  res.status(204).end();
});
