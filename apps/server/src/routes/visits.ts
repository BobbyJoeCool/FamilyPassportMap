import { Router } from "express";
import { Prisma } from "@prisma/client";
import { US_STATE_CODES } from "@familypassportmap/shared";
import { prisma } from "../db.js";

// Mounted at /api/people/:id/visits in index.ts, so req.params.id is the personId.
export const visitsRouter = Router({ mergeParams: true });

async function personExists(id: string): Promise<boolean> {
  const person = await prisma.person.findUnique({ where: { id }, select: { id: true } });
  return person !== null;
}

visitsRouter.get("/", async (req, res) => {
  const { id } = req.params as { id: string };
  if (!(await personExists(id))) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const rows = await prisma.visitedState.findMany({
    where: { personId: id },
    select: { stateCode: true },
  });
  res.json(rows.map((row) => row.stateCode));
});

visitsRouter.put("/:stateCode", async (req, res) => {
  const { id, stateCode } = req.params as { id: string; stateCode: string };
  const normalized = stateCode.toUpperCase();
  if (!US_STATE_CODES.includes(normalized)) {
    res.status(400).json({ error: "Unknown state code" });
    return;
  }

  try {
    // Idempotent: upsert so calling this twice for the same state is a no-op, not an error.
    await prisma.visitedState.upsert({
      where: { personId_stateCode: { personId: id, stateCode: normalized } },
      create: { personId: id, stateCode: normalized },
      update: {},
    });
    res.status(204).end();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    throw error;
  }
});

visitsRouter.delete("/:stateCode", async (req, res) => {
  const { id, stateCode } = req.params as { id: string; stateCode: string };
  if (!(await personExists(id))) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  await prisma.visitedState.deleteMany({
    where: { personId: id, stateCode: stateCode.toUpperCase() },
  });
  res.status(204).end();
});
