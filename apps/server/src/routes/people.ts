import fs from "node:fs/promises";
import { Router, type Request } from "express";
import {
  createPersonSchema,
  MAX_PEOPLE_PER_USER,
  PEOPLE_CAP_MESSAGE,
  updatePersonSchema,
  type PeopleAllowance,
} from "@familypassportmap/shared";
import { actorOf, countOwnedPeople, createOwnedPerson, listViewablePeople, requireEditablePerson } from "../access.js";
import { prisma } from "../db.js";
import { toPersonResponse } from "../personResponse.js";
import { shrinkPhoto } from "../photos.js";
import { uploadPhoto } from "../uploads.js";

/** Router for `/api/people` — CRUD for family members plus profile-photo upload. */
export const peopleRouter = Router();

/**
 * The signed-in User's Primary Person id, for marking "You" in responses.
 * @param req - the request (after requireUser).
 * @returns the id, or null before the welcome step.
 */
function primaryPersonIdOf(req: Request): string | null {
  return req.user?.primaryPersonId ?? null;
}

/** `GET /api/people` — list every person, oldest-added first. */
peopleRouter.get("/", async (req, res) => {
  const people = await listViewablePeople(actorOf(req));
  res.json(people.map((person) => toPersonResponse(person, primaryPersonIdOf(req))));
});

/**
 * `GET /api/people/allowance` — how many People the User owns, against the per-User cap. The
 * People page uses it to disable adding at the cap; it counts OWNED People, which the list
 * above stops matching once Link lets a User see other Users' People.
 */
peopleRouter.get("/allowance", async (req, res) => {
  const allowance: PeopleAllowance = { owned: await countOwnedPeople(actorOf(req)), max: MAX_PEOPLE_PER_USER };
  res.json(allowance);
});

/** `POST /api/people` — create a person from a validated `{ name, colorHex }` body. */
peopleRouter.post("/", async (req, res) => {
  const parsed = createPersonSchema.safeParse(req.body);
  // Reject the request up front if the body fails validation (missing name, bad color, etc.).
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  // The signed-in User becomes the Owner, unless they're at the per-User cap (null).
  const person = await createOwnedPerson(actorOf(req), parsed.data);
  if (!person) {
    res.status(409).json({ error: PEOPLE_CAP_MESSAGE });
    return;
  }
  res.status(201).json(toPersonResponse(person, primaryPersonIdOf(req)));
});

/** `PATCH /api/people/:id` — partially update a person's name and/or color. */
peopleRouter.patch("/:id", requireEditablePerson, async (req, res) => {
  const parsed = updatePersonSchema.safeParse(req.body);
  // Reject a body that fails validation (empty name, bad color) before touching the Person.
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  const { id } = req.params as { id: string };
  const person = await prisma.person.update({ where: { id }, data: parsed.data });
  res.json(toPersonResponse(person, primaryPersonIdOf(req)));
});

/** `DELETE /api/people/:id` — remove a person (their visited states cascade-delete with them). */
peopleRouter.delete("/:id", requireEditablePerson, async (req, res) => {
  const { id } = req.params as { id: string };
  // A User's Primary Person is them: it only goes when the whole account is deleted.
  if (id === primaryPersonIdOf(req)) {
    res.status(409).json({ error: "This is you, so it can't be deleted. To remove it, delete your account." });
    return;
  }

  await prisma.person.delete({ where: { id } });
  res.status(204).end();
});

/**
 * `POST /api/people/:id/photo` — upload/replace a person's profile picture.
 * `requireEditablePerson` runs BEFORE the upload is accepted, so nothing is written to disk
 * for a missing or not-editable Person. Then the `uploadPhoto` multer middleware runs manually
 * (rather than as a normal middleware argument) so multer's own errors (bad type, too large)
 * can be turned into a JSON 400 instead of Express's default error page.
 */
peopleRouter.post("/:id/photo", requireEditablePerson, (req, res, next) => {
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
      const { id } = req.params as { id: string };
      const person = await prisma.person.update({
        where: { id },
        data: { profilePicturePath },
      });
      res.json(toPersonResponse(person, primaryPersonIdOf(req)));
    } catch (error) {
      next(error);
    }
  });
});
