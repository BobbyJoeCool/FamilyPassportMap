import { Router } from "express";
import { Prisma } from "@prisma/client";
import { createPersonSchema, updatePersonSchema, type Person } from "@familypassportmap/shared";
import { prisma } from "../db.js";
import { uploadPhoto } from "../uploads.js";

export const peopleRouter = Router();

function toPerson(row: {
  id: string;
  name: string;
  colorHex: string;
  profilePicturePath: string | null;
  createdAt: Date;
}): Person {
  return {
    id: row.id,
    name: row.name,
    colorHex: row.colorHex,
    profilePicturePath: row.profilePicturePath,
    createdAt: row.createdAt.toISOString(),
  };
}

peopleRouter.get("/", async (_req, res) => {
  const people = await prisma.person.findMany({ orderBy: { createdAt: "asc" } });
  res.json(people.map(toPerson));
});

peopleRouter.post("/", async (req, res) => {
  const parsed = createPersonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  const person = await prisma.person.create({ data: parsed.data });
  res.status(201).json(toPerson(person));
});

peopleRouter.patch("/:id", async (req, res) => {
  const parsed = updatePersonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  try {
    const person = await prisma.person.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(toPerson(person));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    throw error;
  }
});

peopleRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.person.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    throw error;
  }
});

peopleRouter.post("/:id/photo", (req, res, next) => {
  uploadPhoto.single("photo")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No photo uploaded" });
      return;
    }

    try {
      const profilePicturePath = `uploads/${req.file.filename}`;
      const person = await prisma.person.update({
        where: { id: req.params.id },
        data: { profilePicturePath },
      });
      res.json(toPerson(person));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        res.status(404).json({ error: "Person not found" });
        return;
      }
      next(error);
    }
  });
});
