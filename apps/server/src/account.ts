import { listOwnedPeople, signedInActor, type Actor } from "./access.js";
import { prisma } from "./db.js";
import { deletePhotoFile } from "./photos.js";

/**
 * Permanently deletes the actor's account and everything in it: every Person they own (and so
 * those People's state and country visits), their sessions, and the User. One transaction, so
 * it either all goes or none of it does; the schema's cascades remove the rows hanging off the
 * User. The owned People's photo files are removed after the commit, best-effort (a file left
 * behind belongs to nobody, so it's never served).
 * @param actor - the acting User.
 * @throws if nobody is signed in (the route sits behind requireUser).
 */
export async function deleteAccount(actor: Actor | null): Promise<void> {
  const owner = signedInActor(actor, "deleteAccount");
  const photoPaths = await prisma.$transaction(async (tx) => {
    // Read the photos inside the transaction, so a photo uploaded mid-delete isn't missed.
    const people = await listOwnedPeople(owner, tx);
    // The owned People go by the schema's Owner cascade rather than a separate delete: "every
    // Person this User owns" is exactly what ADR 0002's Owner relation means, so the policy
    // and the cascade can't disagree. deleteMany, so a second simultaneous delete is a no-op.
    await tx.user.deleteMany({ where: { id: owner.userId } });
    return people.map((person) => person.profilePicturePath);
  });

  // Each owned Person's photo, one at a time; deletePhotoFile skips People with none.
  for (const photoPath of photoPaths) await deletePhotoFile(photoPath);
}
