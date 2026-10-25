/**
 * The sign-in page URL that comes back to the given page afterwards.
 * @param returnTo - the in-app path to return to.
 * @returns the `/signin?returnTo=…` path.
 */
export function signInPath(returnTo: string): string {
  return `/signin?returnTo=${encodeURIComponent(returnTo)}`;
}
