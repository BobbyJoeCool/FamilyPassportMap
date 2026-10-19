import type { Me } from "@familypassportmap/shared";
import { handleResponse } from "./http";

/**
 * Asks the server who is signed in. Unlike other API calls, a 401 here is an expected
 * answer ("nobody"), not an expired session, so it doesn't trigger the sign-in redirect.
 * @returns the signed-in User, or null when signed out.
 */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch("/api/me");
  // Signed out is a normal state at startup.
  if (res.status === 401) return null;
  return handleResponse<Me>(res);
}

/** Ends this browser's session on the server (the cookie is cleared by the response). */
export async function signOut(): Promise<void> {
  await fetch("/api/auth/signout", { method: "POST" });
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
