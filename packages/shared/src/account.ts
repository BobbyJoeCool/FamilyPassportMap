// API shapes for the signed-in User (Phase 12).

/** The signed-in User as the client sees them. */
export interface SignedInUser {
  id: string;
  email: string;
  displayName: string;
  /** The sign-in provider's profile-picture URL; shown in the header only. */
  avatarUrl: string | null;
}

/** Response of `GET /api/me`. */
export interface Me {
  user: SignedInUser;
}
