import type { NextFunction, Request, Response } from "express";
import type { Person, Prisma } from "@prisma/client";
import { prisma } from "./db.js";

// The access policy: the ONE place that decides which People a User may view or edit.
// Every route that touches a Person, its visits, or its photo asks this module — no route
// filters Person queries on its own. Link and Join (later phases) change only the rules
// in here. See docs/adr/0002-people-have-one-owner-families-group-users.md.

/** Who is making the request, as far as the access policy is concerned. */
export interface Actor {
  userId: string;
}

/**
 * Resolves the acting User for a request.
 * @param req - the incoming request (after the auth middleware).
 * @returns the acting User, or null when nobody is signed in.
 */
export function actorOf(req: Request): Actor | null {
  return req.user ? { userId: req.user.id } : null;
}

/**
 * The Prisma filter selecting every Person the actor may view. Use it for lists and for
 * relation filters (e.g. bulk visit maps) so they agree with the single-Person checks below.
 * @param _actor - the acting User.
 * @returns a `where` clause for `person` queries.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used once ownership lands (ticket #5)
export function viewablePeopleWhere(_actor: Actor | null): Prisma.PersonWhereInput {
  return {};
}

/**
 * The Prisma filter selecting every Person the actor may edit.
 * @param _actor - the acting User.
 * @returns a `where` clause for `person` queries.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used once ownership lands (ticket #5)
function editablePeopleWhere(_actor: Actor | null): Prisma.PersonWhereInput {
  return {};
}

/**
 * Lists every Person the actor may view, oldest-added first.
 * @param actor - the acting User.
 * @returns the viewable People.
 */
export function listViewablePeople(actor: Actor | null): Promise<Person[]> {
  return prisma.person.findMany({ where: viewablePeopleWhere(actor), orderBy: { createdAt: "asc" } });
}

/**
 * Fetches one Person if the actor may view it. A Person that exists but isn't viewable is
 * indistinguishable from one that doesn't exist — callers answer 404 for both.
 * @param actor - the acting User.
 * @param personId - the Person's id.
 * @returns the Person, or null if missing or not viewable.
 */
export function findViewablePerson(actor: Actor | null, personId: string): Promise<Person | null> {
  return prisma.person.findFirst({ where: { AND: [{ id: personId }, viewablePeopleWhere(actor)] } });
}

/**
 * Fetches one Person if the actor may edit it (rename, recolor, delete, change photo, or mark
 * visits). Same not-found semantics as `findViewablePerson`.
 * @param actor - the acting User.
 * @param personId - the Person's id.
 * @returns the Person, or null if missing or not editable.
 */
export function findEditablePerson(actor: Actor | null, personId: string): Promise<Person | null> {
  return prisma.person.findFirst({ where: { AND: [{ id: personId }, editablePeopleWhere(actor)] } });
}

/**
 * Builds a route guard that answers `404 { error: "Person not found" }` unless the actor may
 * access the Person named by the route's `:id` parameter.
 * @param find - the access check to apply (view or edit).
 * @returns Express middleware.
 */
function personGuard(find: (actor: Actor | null, personId: string) => Promise<Person | null>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Missing and not-allowed People look the same to the caller: 404.
    if (!(await find(actorOf(req), req.params.id as string))) {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    next();
  };
}

/** Route guard: continue only if the actor may view the Person in `:id`; otherwise 404. */
export const requireViewablePerson = personGuard(findViewablePerson);

/** Route guard: continue only if the actor may edit the Person in `:id`; otherwise 404. */
export const requireEditablePerson = personGuard(findEditablePerson);
