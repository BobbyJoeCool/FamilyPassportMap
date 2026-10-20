import type { Person } from "@prisma/client";
import { ownedPeopleWhere, type Actor } from "./access.js";
import { prisma } from "./db.js";
import { deletePhotoFile } from "./photos.js";

/** What happened when a User tried to Claim a Person. */
export type ClaimResult =
  | { outcome: "claimed"; person: Person }
  | { outcome: "alreadyPrimary" }
  | { outcome: "notOwned" };

/**
 * Claim ("Set as me"): makes one of the actor's own People their Primary Person. In ONE
 * transaction, every state and country on the old Primary Person that the target lacks is
 * copied over with its original visit date, the target becomes the Primary Person, and the old
 * Primary Person is deleted. Its photo file is removed after the transaction commits.
 * @param actor - the acting User.
 * @param personId - the Person to Claim; must be owned by the actor.
 * @returns the outcome, with the Claimed Person on success.
 * @throws if nobody is signed in (the route sits behind requireUser).
 */
export async function claimPerson(actor: Actor | null, personId: string): Promise<ClaimResult> {
  // Only a signed-in User can Claim; reaching here without one is a wiring bug.
  if (!actor) throw new Error("claimPerson needs a signed-in User");
  const result = await prisma.$transaction(async (tx) => {
    // Re-checked inside the transaction so ownership can't change between check and write.
    const target = await tx.person.findFirst({ where: { AND: [{ id: personId }, ownedPeopleWhere(actor)] } });
    if (!target) return { outcome: "notOwned" as const };

    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId } });
    // Claiming who you already are changes nothing — refuse rather than delete yourself.
    if (user.primaryPersonId === target.id) return { outcome: "alreadyPrimary" as const };

    const oldPrimary = user.primaryPersonId
      ? await tx.person.findUnique({ where: { id: user.primaryPersonId } })
      : null;

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
    await tx.user.update({ where: { id: actor.userId }, data: { primaryPersonId: target.id } });
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
