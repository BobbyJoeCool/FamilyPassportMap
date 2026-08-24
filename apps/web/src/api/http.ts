/**
 * Shared response handler for every API call: parses a successful JSON body, or throws
 * an `Error` carrying the server's message for a failed one.
 * @param response - the raw `fetch` response.
 * @returns the parsed JSON body, typed as `T`.
 */
export async function handleResponse<T>(response: Response): Promise<T> {
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
