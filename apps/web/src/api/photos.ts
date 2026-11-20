/** Turns a stored photo path ("uploads/<file>") into a URL an `<img>` can load. */
export type PhotoUrlResolver = (profilePicturePath: string) => string;

/**
 * The normal app's resolver: the server serves photos at `/uploads/<file>`.
 * @param profilePicturePath - the Person's stored path.
 * @returns the root-relative URL.
 */
function serverPhotoUrl(profilePicturePath: string): string {
  return `/${profilePicturePath}`;
}

let resolver: PhotoUrlResolver = serverPhotoUrl;

/**
 * The URL to show a Person's photo from. An `<img>` request doesn't go through `fetch`, so the
 * guest demo (which answers `/uploads` from memory) swaps in its own resolver; everything else
 * gets the server's `/uploads/<file>`.
 * @param profilePicturePath - the Person's stored path ("uploads/<file>").
 * @returns a URL for `<img src>`.
 */
export function photoUrl(profilePicturePath: string): string {
  return resolver(profilePicturePath);
}

/**
 * Replaces how photo paths become URLs. Only the guest demo calls this, once, at startup.
 * @param next - the new resolver, or null to go back to the server's URLs.
 */
export function setPhotoUrlResolver(next: PhotoUrlResolver | null): void {
  resolver = next ?? serverPhotoUrl;
}
