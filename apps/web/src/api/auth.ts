import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  AvailableSignInMethods,
  CreatePersonInput,
  CurrentUserResponse,
  Person,
  Provider,
  SignInIntent,
  SignInMethodsResponse,
  SignInMethodSummary,
  SignInResult,
} from "@familypassportmap/shared";
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
 * The URL that starts a provider round trip. A real navigation, not a fetch: the browser has to
 * leave for the provider's page and come back.
 * @param provider - "microsoft", "google" or "github".
 * @param returnTo - the in-app path to land on afterwards (signing in only).
 * @param intent - "sign-in" (default) or "add" (to the signed-in account; comes back to the
 *   Sign-in methods page).
 * @returns the start URL.
 */
export function providerSignInUrl(provider: Provider, returnTo: string, intent: SignInIntent = "sign-in"): string {
  const params = new URLSearchParams({ returnTo });
  // Only adding needs saying; signing in is the default.
  if (intent === "add") params.set("intent", "add");
  return `/api/auth/${provider}?${params.toString()}`;
}

/**
 * Which ways of signing in the server offers. Public: called while signed out.
 * @returns the enabled providers, and whether passkeys are available.
 */
export async function fetchAvailableSignInMethods(): Promise<AvailableSignInMethods> {
  return handleResponse<AvailableSignInMethods>(await fetch("/api/auth/methods"));
}

/**
 * POSTs JSON and parses the reply.
 * @param url - the API path.
 * @param body - the JSON body (omit for none).
 * @returns the parsed response.
 */
async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/**
 * Signs in with a passkey: the browser offers this site's passkeys and the chosen one signs the
 * server's challenge.
 * @param returnTo - the page to land on afterwards.
 * @returns where to go next.
 * @throws if the visitor cancels, or the server refuses the passkey.
 */
export async function signInWithPasskey(returnTo: string): Promise<SignInResult> {
  const optionsJSON = await postJson<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/auth/passkey/signin/options");
  const response = await startAuthentication({ optionsJSON });
  return postJson<SignInResult>("/api/auth/passkey/signin/verify", { response, returnTo });
}

/**
 * Creates a passkey: signed out, for a new account; signed in, added to the account.
 * @param name - the passkey's name (adding only; a new account's passkey is named "Passkey").
 * @returns where to go next when signing up, or undefined when added to an account.
 * @throws if the visitor cancels, or the server refuses.
 */
export async function createPasskey(name?: string): Promise<SignInResult | undefined> {
  const optionsJSON = await postJson<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/auth/passkey/register/options");
  const response = await startRegistration({ optionsJSON });
  return postJson<SignInResult | undefined>("/api/auth/passkey/register/verify", { response, name });
}

/**
 * Lists the signed-in User's sign-in methods.
 * @returns every method, oldest first.
 */
export async function listSignInMethods(): Promise<SignInMethodSummary[]> {
  return (await handleResponse<SignInMethodsResponse>(await fetch("/api/me/sign-in-methods"))).methods;
}

/**
 * Removes one of the signed-in User's sign-in methods.
 * @param id - the method's id.
 * @throws with the server's message (e.g. it's the last one).
 */
export async function removeSignInMethod(id: string): Promise<void> {
  await handleResponse<void>(await fetch(`/api/me/sign-in-methods/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

/**
 * Renames one of the signed-in User's passkeys.
 * @param id - the passkey's id.
 * @param name - the new name (1 to 40 characters).
 * @returns the updated summary.
 */
export async function renamePasskey(id: string, name: string): Promise<SignInMethodSummary> {
  const res = await fetch(`/api/me/passkeys/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return handleResponse<SignInMethodSummary>(res);
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
