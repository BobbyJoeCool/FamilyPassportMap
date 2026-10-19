import type { CurrentUserResponse } from "@familypassportmap/shared";
import { handleResponse } from "./http";

/**
 * Asks the server who is signed in. Unlike other API calls, a 401 here is an expected
 * answer ("nobody"), not an expired session, so it doesn't trigger the sign-in redirect.
 * @returns the signed-in User, or null when signed out.
 */
export async function fetchCurrentUser(): Promise<CurrentUserResponse | null> {
  const res = await fetch("/api/me");
  // Signed out is a normal state at startup.
  if (res.status === 401) return null;
  return handleResponse<CurrentUserResponse>(res);
}

/**
 * Ends this browser's session on the server (the cookie is cleared by the response).
 * @throws if the server couldn't be reached or refused.
 */
export async function signOut(): Promise<void> {
  const res = await fetch("/api/auth/signout", { method: "POST" });
  // Anything but success means the session may still be live — the caller must not pretend.
  if (!res.ok) throw new Error(`Sign out failed with status ${res.status}`);
}

/**
 * The URL that starts Google sign-in. A real navigation, not a fetch: the browser has to
 * leave for Google's page and come back.
 * @param returnTo - the in-app path to land on afterwards.
 * @returns the sign-in start URL.
 */
export function googleSignInUrl(returnTo: string): string {
  return `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}
