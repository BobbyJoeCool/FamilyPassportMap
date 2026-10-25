import type { CreatePersonInput, CurrentUserResponse, Person } from "@familypassportmap/shared";
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
 * The welcome step: creates the Person who is the signed-in User.
 * @param input - their name and chosen color.
 * @returns the new Primary Person, or null if the User already has one (e.g. the welcome
 *   step was finished in another tab) — either way, welcome is done.
 */
export async function createPrimaryPerson(input: CreatePersonInput): Promise<Person | null> {
  const res = await fetch("/api/me/primary-person", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  // 409 = already has a Primary Person: not an error from the User's point of view.
  if (res.status === 409) return null;
  return handleResponse<Person>(res);
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
 * The URL that starts Microsoft sign-in. A real navigation, not a fetch: the browser has to
 * leave for Microsoft's page and come back.
 * @param returnTo - the in-app path to land on afterwards.
 * @returns the sign-in start URL.
 */
export function microsoftSignInUrl(returnTo: string): string {
  return `/api/auth/microsoft?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Permanently deletes the signed-in User's account and everything they own (the server also
 * ends every session and clears the cookie). An expired session goes to sign-in, like any
 * other call, rather than being reported as a connection problem.
 * @throws if the server couldn't be reached or refused — the account may still exist.
 */
export async function deleteAccount(): Promise<void> {
  await handleResponse<void>(await fetch("/api/me", { method: "DELETE" }));
}
