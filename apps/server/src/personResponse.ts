import type { Person as PersonRow } from "@prisma/client";
import type { Person } from "@familypassportmap/shared";

/**
 * Converts a Prisma `Person` row into the API's `Person` shape.
 * @param row - the raw row as returned by Prisma.
 * @param primaryPersonId - the signed-in User's Primary Person id (null before welcome), so
 *   the response can say whether this Person is them.
 * @returns the API shape, with `createdAt` as an ISO 8601 string for the wire.
 */
export function toPersonResponse(row: PersonRow, primaryPersonId: string | null): Person {
  return {
    id: row.id,
    name: row.name,
    colorHex: row.colorHex,
    profilePicturePath: row.profilePicturePath,
    createdAt: row.createdAt.toISOString(),
    isPrimary: row.id === primaryPersonId,
  };
}
