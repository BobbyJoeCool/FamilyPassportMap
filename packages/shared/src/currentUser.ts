// API shapes for the signed-in User (Phase 12).

/** The signed-in User as the client sees them. */
export interface SignedInUser {
  id: string;
  email: string;
  displayName: string;
  /** The sign-in provider's profile-picture URL; shown in the header only. */
  avatarUrl: string | null;
}

/** Response of `GET /api/me`: who is signed in. */
export interface CurrentUserResponse {
  user: SignedInUser;
  /** The Person who is this User; null until they finish the welcome step. */
  primaryPersonId: string | null;
}
