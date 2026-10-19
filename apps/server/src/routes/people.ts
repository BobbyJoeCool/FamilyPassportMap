import fs from "node:fs/promises";
import { Router } from "express";
import { createPersonSchema, updatePersonSchema, type Person } from "@familypassportmap/shared";
import { actorOf, findEditablePerson, listViewablePeople } from "../access.js";
import { prisma } from "../db.js";
import { shrinkPhoto } from "../photos.js";
import { uploadPhoto } from "../uploads.js";

/** Router for `/api/people` — CRUD for family members plus profile-photo upload. */
export const peopleRouter = Router();

/**
 * Converts a Prisma `Person` row into the API's `Person` shape.
 * @param row - the raw row as returned by Prisma.
 * @returns the same person, with `createdAt` serialized to an ISO 8601 string for the wire.
 */
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

/** `GET /api/people` — list every person, oldest-added first. */
peopleRouter.get("/", async (req, res) => {
  const people = await listViewablePeople(actorOf(req));
  res.json(people.map(toPerson));
});

/** `POST /api/people` — create a person from a validated `{ name, colorHex }` body. */
peopleRouter.post("/", async (req, res) => {
  const parsed = createPersonSchema.safeParse(req.body);
  // Reject the request up front if the body fails validation (missing name, bad color, etc.).
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  const person = await prisma.person.create({ data: parsed.data });
  res.status(201).json(toPerson(person));
});

/** `PATCH /api/people/:id` — partially update a person's name and/or color. */
peopleRouter.patch("/:id", async (req, res) => {
  const parsed = updatePersonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  // Missing and not-editable People look the same to the caller: 404.
  if (!(await findEditablePerson(actorOf(req), req.params.id))) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  const person = await prisma.person.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(toPerson(person));
});

/** `DELETE /api/people/:id` — remove a person (their visited states cascade-delete with them). */
peopleRouter.delete("/:id", async (req, res) => {
  // Missing and not-editable People look the same to the caller: 404.
  if (!(await findEditablePerson(actorOf(req), req.params.id))) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  await prisma.person.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/**
 * `POST /api/people/:id/photo` — upload/replace a person's profile picture.
 * The Person is checked BEFORE the upload is accepted, so nothing is written to disk for a
 * missing or not-editable Person. Then the `uploadPhoto` multer middleware runs manually
 * (rather than as a normal middleware argument) so multer's own errors (bad type, too large)
 * can be turned into a JSON 400 instead of Express's default error page.
 */
peopleRouter.post("/:id/photo", async (req, res, next) => {
  // Missing and not-editable People look the same to the caller: 404.
  if (!(await findEditablePerson(actorOf(req), req.params.id))) {
    res.status(404).json({ error: "Person not found" });
    return;
  }

  uploadPhoto.single("photo")(req, res, async (err) => {
    // Multer failed the upload (wrong type, too large) before a file was saved.
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
      return;
    }
    // No file field was present in the multipart body at all.
    if (!req.file) {
      res.status(400).json({ error: "No photo uploaded" });
      return;
    }

    try {
      await shrinkPhoto(req.file.path);
    } catch {
      // The bytes claimed an image type but sharp couldn't decode them — discard the file.
      await fs.rm(req.file.path, { force: true });
      res.status(400).json({ error: "Photo couldn't be read as an image." });
      return;
    }

    try {
      // Relative to the server root — must match the "/uploads" mount in app.ts.
      const profilePicturePath = `uploads/${req.file.filename}`;
      const person = await prisma.person.update({
        where: { id: req.params.id },
        data: { profilePicturePath },
      });
      res.json(toPerson(person));
    } catch (error) {
      next(error);
    }
  });
});
