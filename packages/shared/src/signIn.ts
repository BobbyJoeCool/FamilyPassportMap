// Sign-in rules shared by the server (which enforces them) and the web app (which follows them).

/** Where a signed-in User lands when no (valid) return path was given. */
export const DEFAULT_LANDING_PATH = "/us/map";

/** Why a sign-in didn't complete; the server sends it to the sign-in page as `?error=`. */
export const SIGN_IN_ERRORS = ["cancelled", "failed"] as const;
export type SignInError = (typeof SIGN_IN_ERRORS)[number];

/**
 * Accepts a post-sign-in destination only if it's a path inside this app, so a crafted
 * sign-in link can't bounce the User to another site.
 * @param value - the requested return path (untrusted input).
 * @returns the path to use: the value itself, or `DEFAULT_LANDING_PATH`.
 */
export function safeReturnTo(value: unknown): string {
  // Must be a same-origin relative path: one leading "/", not "//host" or "/\host"
  // (both of which browsers treat as another origin).
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return DEFAULT_LANDING_PATH;
}
