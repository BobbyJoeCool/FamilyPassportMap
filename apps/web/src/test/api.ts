import { vi } from "vitest";
import type { Person } from "@familypassportmap/shared";

/** One request the code under test sent through the faked `fetch`. */
export interface FetchCall {
  method: string;
  url: string;
  /** The request body: parsed JSON when it was a JSON string, otherwise as sent (e.g. FormData). */
  body: unknown;
}

/** What a faked route answers: a ready Response, a JSON body (sent as 200), or a function of the call. */
type RouteAnswer = Response | unknown | ((call: FetchCall) => Response | unknown);

/**
 * A JSON response, for routes that need a status other than 200.
 * @param status - the HTTP status.
 * @param body - the JSON body; omit for an empty body.
 * @returns the Response.
 */
export function jsonResponse(status: number, body?: unknown): Response {
  // 204 must not carry a body, or the Response constructor throws.
  if (body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Replaces the global `fetch` with a fake that answers from a table of routes, keyed by
 * "METHOD /path" (e.g. "GET /api/people"). A request with no matching route fails the test
 * loudly with a 500, rather than hanging.
 * @param routes - the answers, by method and path.
 * @returns the list of calls made so far (it keeps growing) and the underlying mock.
 */
export function mockFetch(routes: Record<string, RouteAnswer>) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
    const method = (init.method ?? "GET").toUpperCase();
    let body: unknown = init.body;
    // JSON bodies are compared as objects in assertions, so parse them back.
    if (typeof body === "string") body = JSON.parse(body);
    const call = { method, url, body };
    calls.push(call);

    const key = `${method} ${url.split("?")[0]}`;
    // Unmatched routes are a test-setup mistake; answer 500 with the route so it's obvious.
    if (!(key in routes)) return jsonResponse(500, { error: `No fake route for ${key}` });
    const route = routes[key];
    const answer = typeof route === "function" ? (route as (call: FetchCall) => unknown)(call) : route;
    // A Response is sent as is; anything else is a 200 JSON body.
    return answer instanceof Response ? answer : jsonResponse(200, answer);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

/**
 * Builds a Person as the API returns it.
 * @param overrides - fields to change from the defaults (at least an id and name, usually).
 * @returns the Person.
 */
export function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    name: "Alice",
    colorHex: "#3366cc",
    profilePicturePath: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isPrimary: false,
    ...overrides,
  };
}
