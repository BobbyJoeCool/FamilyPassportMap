import type { Person } from "@prisma/client";
import type { CreatePersonInput } from "@familypassportmap/shared";
import { findEditablePerson, findOwnedPerson, insertOwnedPerson, signedInActor, type Actor } from "./access.js";
import { prisma } from "./db.js";
import { deletePhotoFile } from "./photos.js";

// Operations that keep the Primary Person rule true: every User has exactly one Primary
// Person, which only the welcome step creates, only Claim replaces, and nothing deletes on
// its own. Each runs in one transaction; this SQLite adapter serializes transactions, so two
// of these can't interleave. Access checks come from the access-policy module (ADR 0002).

/**
 * The welcome step: creates the actor's Primary Person. Not limited by the per-User cap, so
 * a User who already owns 10 People (e.g. after Adopting Legacy People) can still finish
 * welcome.
 * @param actor - the acting User, who becomes the Owner and whose Primary Person this is.
 * @param data - the validated name and color.
 * @returns the new Primary Person, or null if the actor already has one.
 * @throws if nobody is signed in.
 */
export async function createPrimaryPerson(actor: Actor | null, data: CreatePersonInput): Promise<Person | null> {
  const owner = signedInActor(actor, "createPrimaryPerson");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: owner.userId } });
    // Already done the welcome step — there's exactly one Primary Person per User.
    if (user.primaryPersonId) return null;
    const person = await insertOwnedPerson(tx, owner, data);
    await tx.user.update({ where: { id: owner.userId }, data: { primaryPersonId: person.id } });
    return person;
  });
}

/** What happened when a User tried to Claim a Person. */
export type ClaimResult =
  | { outcome: "claimed"; person: Person }
  | { outcome: "alreadyPrimary" }
  | { outcome: "notOwned" };

/**
 * Claim ("Set as me"): makes one of the actor's own People their Primary Person. In ONE
 * transaction, every state and country on the old Primary Person that the target lacks is
 * copied over with its original visit date, the target becomes the Primary Person, and the old
 * Primary Person is deleted. Its photo file is removed after the transaction commits. A User
 * with no Primary Person yet simply gets the target (nothing to merge).
 * @param actor - the acting User.
 * @param personId - the Person to Claim; must be owned by the actor.
 * @returns the outcome, with the Claimed Person on success.
 * @throws if nobody is signed in (the route sits behind requireUser).
 */
export async function claimPerson(actor: Actor | null, personId: string): Promise<ClaimResult> {
  const claimant = signedInActor(actor, "claimPerson");
  const result = await prisma.$transaction(async (tx) => {
    // Re-checked inside the transaction so ownership can't change between check and write.
    const target = await findOwnedPerson(claimant, personId, tx);
    if (!target) return { outcome: "notOwned" as const };

    const user = await tx.user.findUniqueOrThrow({ where: { id: claimant.userId } });
    // Claiming who you already are changes nothing — refuse rather than delete yourself.
    if (user.primaryPersonId === target.id) return { outcome: "alreadyPrimary" as const };

    // Before the welcome step there's no old Primary Person, so nothing to merge or delete.
    const oldPrimary = user.primaryPersonId ? await tx.person.findUnique({ where: { id: user.primaryPersonId } }) : null;

    // Merge: copy visits the target doesn't already have. Its own visits keep their dates.
    if (oldPrimary) {
      const [targetStates, targetCountries, oldStates, oldCountries] = await Promise.all([
        tx.visitedState.findMany({ where: { personId: target.id }, select: { stateCode: true } }),
        tx.visitedCountry.findMany({ where: { personId: target.id }, select: { countryCode: true } }),
        tx.visitedState.findMany({ where: { personId: oldPrimary.id } }),
        tx.visitedCountry.findMany({ where: { personId: oldPrimary.id } }),
      ]);
      const haveStates = new Set(targetStates.map((row) => row.stateCode));
      const haveCountries = new Set(targetCountries.map((row) => row.countryCode));
      // Only the old Primary Person's visits the target lacks, each with its original date.
      await tx.visitedState.createMany({
        data: oldStates
          .filter((row) => !haveStates.has(row.stateCode))
          .map((row) => ({ personId: target.id, stateCode: row.stateCode, visitedAt: row.visitedAt })),
      });
      await tx.visitedCountry.createMany({
        data: oldCountries
          .filter((row) => !haveCountries.has(row.countryCode))
          .map((row) => ({ personId: target.id, countryCode: row.countryCode, visitedAt: row.visitedAt })),
      });
    }

    // Point the User at the target BEFORE deleting the old Person (primaryPersonId is unique).
    await tx.user.update({ where: { id: claimant.userId }, data: { primaryPersonId: target.id } });
    // The old Primary Person goes (its visits cascade with it); it's now merged into the target.
    if (oldPrimary) await tx.person.delete({ where: { id: oldPrimary.id } });

    return { outcome: "claimed" as const, person: target, removedPhotoPath: oldPrimary?.profilePicturePath ?? null };
  });

  // Files aren't transactional: only remove the old photo once the database change is final.
  if (result.outcome === "claimed") {
    await deletePhotoFile(result.removedPhotoPath);
    return { outcome: "claimed", person: result.person };
  }
  return result;
}

/** What happened when a User tried to delete a Person. */
export type DeletePersonResult = "deleted" | "isPrimary" | "notFound";

/**
 * Deletes a Person the actor may edit — unless it's the actor's Primary Person, which only
 * goes with the whole account. Checked inside the same transaction as the delete, so a Claim
 * landing in between can't let the new Primary Person be deleted.
 * @param actor - the acting User.
 * @param personId - the Person to delete.
 * @returns the outcome.
 * @throws if nobody is signed in.
 */
export async function deletePersonUnlessPrimary(actor: Actor | null, personId: string): Promise<DeletePersonResult> {
  const deleter = signedInActor(actor, "deletePersonUnlessPrimary");
  return prisma.$transaction(async (tx) => {
    // Missing or not editable: same 404 the route guard gives.
    if (!(await findEditablePerson(deleter, personId, tx))) return "notFound";
    const user = await tx.user.findUniqueOrThrow({ where: { id: deleter.userId } });
    // The actor's Primary Person is them: never deleted on its own.
    if (user.primaryPersonId === personId) return "isPrimary";
    // Visits cascade with the Person.
    await tx.person.delete({ where: { id: personId } });
    return "deleted";
  });
}
