import { Router } from "express";
import { createPersonSchema, type CurrentUserResponse } from "@familypassportmap/shared";
import { actorOf } from "../access.js";
import { deleteAccount } from "../account.js";
import { SESSION_COOKIE, sessionCookieOptions } from "../auth/sessions.js";
import { createPrimaryPerson } from "../primaryPerson.js";
import { toPersonResponse } from "../personResponse.js";

/** Router for `/api/me` — the signed-in User. Mounted behind `requireUser`. */
export const currentUserRouter = Router();

/** `GET /api/me` — who is signed in, and their Primary Person (null until welcome is done). */
currentUserRouter.get("/", (req, res) => {
  const user = req.user!;
  const response: CurrentUserResponse = {
    user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
    primaryPersonId: user.primaryPersonId,
  };
  res.json(response);
});

/**
 * `POST /api/me/primary-person` — the welcome step: create the Person who is this User, from a
 * validated `{ name, colorHex }` (same rules as any Person). Not limited by the People cap.
 */
currentUserRouter.post("/primary-person", async (req, res) => {
  const parsed = createPersonSchema.safeParse(req.body);
  // Reject a body that fails validation (missing name, bad color) up front.
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  const person = await createPrimaryPerson(actorOf(req), parsed.data);
  // Null means the welcome step was already done — a User has exactly one Primary Person.
  if (!person) {
    res.status(409).json({ error: "You already have a Primary Person." });
    return;
  }
  res.status(201).json(toPersonResponse(person, person.id));
});

/**
 * `DELETE /api/me` — permanently delete the signed-in User's account and everything they own
 * (see `deleteAccount`). Every session goes with it, so the cookie is cleared too.
 */
currentUserRouter.delete("/", async (req, res) => {
  await deleteAccount(actorOf(req));
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).end();
});
