/**
 * Shared response handler for every API call: parses a successful JSON body, or throws
 * an `Error` carrying the server's message for a failed one.
 * @param response - the raw `fetch` response.
 * @returns the parsed JSON body, typed as `T`.
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  // The session expired (or was ended elsewhere) mid-use: go sign in, then come back here.
  if (response.status === 401) {
    redirectToSignIn();
    throw new Error("Not signed in");
  }
  // Request failed — try to pull a server-provided error message, falling back to the
  // HTTP status if the body isn't JSON (e.g. a network-layer error page).
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }
  // No response body to parse (e.g. a successful DELETE).
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

/**
 * Sends the browser to the sign-in page with the current page as the place to come back to.
 * A full page load (not a router navigation) so nothing from the old session stays in memory.
 */
export function redirectToSignIn(): void {
  const here = window.location.pathname + window.location.search;
  window.location.assign(`/signin?returnTo=${encodeURIComponent(here)}`);
}
