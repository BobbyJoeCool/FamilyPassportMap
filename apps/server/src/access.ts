import type { NextFunction, Request, Response } from "express";
import type { Person, Prisma } from "@prisma/client";
import { MAX_PEOPLE_PER_USER, type CreatePersonInput } from "@familypassportmap/shared";
import { prisma } from "./db.js";

// The access policy: the ONE place that decides which People a User may view, edit, or own,
// and the one place a Person is given an Owner. Every route or operation that touches a
// Person, its visits, or its photo asks this module — nothing else builds Person ownership
// or visibility filters. Link and Join (later phases) change only the rules in here.
// See docs/adr/0002-people-have-one-owner-families-group-users.md.

/** Who is making the request, as far as the access policy is concerned. */
export interface Actor {
  userId: string;
}

/**
 * A database handle: the shared client, or the client inside a `prisma.$transaction`. Helpers
 * take one so an operation can run its access checks inside its own transaction.
 */
export type Db = Prisma.TransactionClient;

/**
 * Resolves the acting User for a request.
 * @param req - the incoming request (after the auth middleware).
 * @returns the acting User, or null when nobody is signed in.
 */
export function actorOf(req: Request): Actor | null {
  return req.user ? { userId: req.user.id } : null;
}

/**
 * Asserts there is a signed-in actor, for operations that only make sense for one.
 * @param actor - the acting User, if any.
 * @param operation - the operation's name, for the error message.
 * @returns the actor.
 * @throws if nobody is signed in — the route was wired without `requireUser`, a bug.
 */
export function signedInActor(actor: Actor | null, operation: string): Actor {
  // Every caller sits behind requireUser, so a missing actor means a wiring mistake.
  if (!actor) throw new Error(`${operation} needs a signed-in User`);
  return actor;
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
 * Lists every Person the actor owns — what deleting their account removes. Ownership, not
 * visibility: Linked People (later phases) belong to someone else and stay.
 * @param actor - the acting User.
 * @param db - the database handle (a transaction's, to read inside it).
 * @returns the owned People.
 */
export function listOwnedPeople(actor: Actor | null, db: Db = prisma): Promise<Person[]> {
  return db.person.findMany({ where: ownedPeopleWhere(actor) });
}

/**
 * Counts the People the actor owns — what the per-User cap limits. Ownership, not
 * visibility: Linked or Joined People (later phases) never count toward it.
 * @param actor - the acting User.
 * @param db - the database handle (a transaction's, to count inside it).
 * @returns how many People the actor owns.
 */
export function countOwnedPeople(actor: Actor | null, db: Db = prisma): Promise<number> {
  return db.person.count({ where: ownedPeopleWhere(actor) });
}

/**
 * Inserts a Person owned by the actor — the one place a Person is given an Owner. No cap
 * check: callers decide whether one applies.
 * @param db - the database handle (normally a transaction's).
 * @param actor - the acting User, who becomes the Owner.
 * @param data - the new Person's validated name and color.
 * @returns the new Person.
 */
export function insertOwnedPerson(db: Db, actor: Actor, data: CreatePersonInput): Promise<Person> {
  return db.person.create({ data: { ...data, ownerId: actor.userId } });
}

/**
 * Adopts the Legacy People: makes the actor the Owner of every Person that has no Owner. The
 * caller decides who may Adopt (only the site owner). Ignores the People cap, and Adopted
 * People are ordinary People, not anyone's Primary Person. Safe to repeat: once there are no
 * Legacy People left, it changes nothing.
 * @param actor - the User who becomes the Owner.
 * @returns how many People were Adopted.
 */
export async function adoptLegacyPeople(actor: Actor): Promise<number> {
  const { count } = await prisma.person.updateMany({ where: { ownerId: null }, data: { ownerId: actor.userId } });
  return count;
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
export async function createOwnedPerson(actor: Actor | null, data: CreatePersonInput): Promise<Person | null> {
  const owner = signedInActor(actor, "createOwnedPerson");
  return prisma.$transaction(async (tx) => {
    // At the cap: refuse inside the transaction, so the count can't go stale before the insert.
    if ((await countOwnedPeople(owner, tx)) >= MAX_PEOPLE_PER_USER) return null;
    return insertOwnedPerson(tx, owner, data);
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
 * Fetches the Person whose profile photo is the given stored path, if the actor may view that
 * Person. A photo is only as visible as its Person: no match (a stray or replaced file, someone
 * else's Person, or nobody signed in) is null, and callers answer 404 for all of them.
 * @param actor - the acting User.
 * @param profilePicturePath - the stored path ("uploads/<file>").
 * @returns the Person, or null if no viewable Person has this photo.
 */
export function findViewablePersonByPhoto(actor: Actor | null, profilePicturePath: string): Promise<Person | null> {
  return prisma.person.findFirst({ where: { AND: [{ profilePicturePath }, viewablePeopleWhere(actor)] } });
}

/**
 * Fetches one Person if the actor may edit it (rename, recolor, delete, change photo, or mark
 * visits). Same not-found semantics as `findViewablePerson`.
 * @param actor - the acting User.
 * @param personId - the Person's id.
 * @param db - the database handle (a transaction's, to check inside it).
 * @returns the Person, or null if missing or not editable.
 */
export function findEditablePerson(actor: Actor | null, personId: string, db: Db = prisma): Promise<Person | null> {
  return db.person.findFirst({ where: { AND: [{ id: personId }, editablePeopleWhere(actor)] } });
}

/**
 * Fetches one Person if the actor OWNS it — stricter than edit once Join exists (a Joined
 * User may edit People they don't own, but only the Owner may Claim them without approval).
 * @param actor - the acting User.
 * @param personId - the Person's id.
 * @param db - the database handle (a transaction's, to check inside it).
 * @returns the Person, or null if missing or not owned.
 */
export function findOwnedPerson(actor: Actor | null, personId: string, db: Db = prisma): Promise<Person | null> {
  return db.person.findFirst({ where: { AND: [{ id: personId }, ownedPeopleWhere(actor)] } });
}

/**
 * Builds a route guard that answers `404 { error: "Person not found" }` unless the actor may
 * access the Person named by the route's `:id` parameter.
 * @param find - the access check to apply (view, edit, or own).
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
export const requireEditablePerson = personGuard((actor, personId) => findEditablePerson(actor, personId));

/** Route guard: continue only if the actor owns the Person in `:id`; otherwise 404. */
export const requireOwnedPerson = personGuard((actor, personId) => findOwnedPerson(actor, personId));
