import type { NextFunction, Request, Response } from "express";
import type { Person, Prisma } from "@prisma/client";
import { MAX_PEOPLE_PER_USER } from "@familypassportmap/shared";
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
 * Today a User may view exactly the People they own (Link will widen this).
 * @param actor - the acting User.
 * @returns a `where` clause for `person` queries.
 */
export function viewablePeopleWhere(actor: Actor | null): Prisma.PersonWhereInput {
  return ownedPeopleWhere(actor);
}

/**
 * The Prisma filter selecting every Person the actor may edit. Today: exactly the People they
 * own (Join will widen this).
 * @param actor - the acting User.
 * @returns a `where` clause for `person` queries.
 */
function editablePeopleWhere(actor: Actor | null): Prisma.PersonWhereInput {
  return ownedPeopleWhere(actor);
}

/**
 * The Prisma filter for People owned by the actor. Legacy People (no Owner until Adopted)
 * never match, and nobody signed in matches nothing.
 * @param actor - the acting User.
 * @returns a `where` clause for `person` queries.
 */
function ownedPeopleWhere(actor: Actor | null): Prisma.PersonWhereInput {
  // No actor can own anything — an always-false filter rather than "no filter".
  return actor ? { ownerId: actor.userId } : { id: { in: [] } };
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
 * Counts the People the actor owns — what the per-User cap limits. Ownership, not
 * visibility: Linked or Joined People (later phases) never count toward it.
 * @param actor - the acting User.
 * @returns how many People the actor owns.
 */
export function countOwnedPeople(actor: Actor | null): Promise<number> {
  return prisma.person.count({ where: ownedPeopleWhere(actor) });
}

/**
 * Creates a Person owned by the actor, unless they already own `MAX_PEOPLE_PER_USER`. The
 * count and the insert run in one transaction, and this SQLite adapter serializes
 * transactions, so simultaneous adds can't both take the last place.
 * @param actor - the acting User, who becomes the Owner.
 * @param data - the new Person's validated name and color.
 * @returns the new Person, or null when the actor is already at the cap.
 * @throws if nobody is signed in (routes using this sit behind requireUser).
 */
export async function createOwnedPerson(
  actor: Actor | null,
  data: { name: string; colorHex: string },
): Promise<Person | null> {
  // Only a signed-in User can own a Person; reaching here without one is a wiring bug.
  if (!actor) throw new Error("createOwnedPerson needs a signed-in User");
  return prisma.$transaction(async (tx) => {
    // At the cap: refuse inside the transaction, so the count can't go stale before the insert.
    if ((await tx.person.count({ where: ownedPeopleWhere(actor) })) >= MAX_PEOPLE_PER_USER) return null;
    return tx.person.create({ data: { ...data, ownerId: actor.userId } });
  });
}

/**
 * Creates the actor's Primary Person (the welcome step). Not limited by the per-User cap, so
 * a User who already owns 10 People (e.g. after Adopting Legacy People) can still finish
 * welcome. Runs in one transaction so a double-submit can't create two.
 * @param actor - the acting User, who becomes the Owner and whose Primary Person this is.
 * @param data - the validated name and color.
 * @returns the new Primary Person, or null if the actor already has one.
 * @throws if nobody is signed in.
 */
export async function createPrimaryPerson(
  actor: Actor | null,
  data: { name: string; colorHex: string },
): Promise<Person | null> {
  // Only a signed-in User can have a Primary Person; reaching here without one is a wiring bug.
  if (!actor) throw new Error("createPrimaryPerson needs a signed-in User");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId } });
    // Already done the welcome step — there's exactly one Primary Person per User.
    if (user.primaryPersonId) return null;
    const person = await tx.person.create({ data: { ...data, ownerId: actor.userId } });
    await tx.user.update({ where: { id: actor.userId }, data: { primaryPersonId: person.id } });
    return person;
  });
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
