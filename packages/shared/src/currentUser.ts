// API shapes for the signed-in User (Phase 12).

/** The signed-in User as the client sees them. */
export interface SignedInUser {
  id: string;
  /** Null for an account with no email address (passkey-only, Phase 13). */
  email: string | null;
  /** "" until a provider gives a name or the welcome step sets it from the Primary Person. */
  displayName: string;
  /** The last sign-in provider's profile-picture URL (Google, GitHub); shown in the header only. */
  avatarUrl: string | null;
}

/** Response of `GET /api/me`: who is signed in. */
export interface CurrentUserResponse {
  user: SignedInUser;
  /** The Person who is this User; null until they finish the welcome step. */
  primaryPersonId: string | null;
}

/**
 * The name to show for a User: their display name, else their email, else "New user" (a passkey
 * account before the welcome step).
 * @param user - the signed-in User.
 * @returns the label for the header and account menu.
 */
export function userLabel(user: Pick<SignedInUser, "displayName" | "email">): string {
  return user.displayName || user.email || "New user";
}
