import {
  ALLOWED_PHOTO_MIME_TYPES,
  COUNTRY_CODES,
  createPersonSchema,
  MAX_PEOPLE_PER_USER,
  MAX_PHOTO_SIZE_BYTES,
  PEOPLE_CAP_MESSAGE,
  updatePersonSchema,
  US_STATE_CODES,
  type CurrentUserResponse,
  type PeopleAllowance,
  type Person,
} from "@familypassportmap/shared";
import { newId, type DemoPerson, type DemoStore } from "./store";

// The guest demo's stand-in for the server: answers the same /api and /uploads requests with the
// same statuses, bodies and error messages, from an in-memory store. Rules that live in
// packages/shared are reused; rules that live only in the server's code are copied here, and the
// API contract tests (packages/shared/contract) run the same scenarios against both to keep them
// matched. Every new server route needs a handler here, or the demo answers NOT_AVAILABLE.

/** The answer for any /api route the demo doesn't have (sign-in, account deletion, …). */
export const NOT_AVAILABLE = "Not available in the demo.";

/** Who the visitor is in the demo. There's no sign-in, so it's always this Guest. */
export const GUEST_USER = { id: "demo-guest", email: "", displayName: "Guest", avatarUrl: null };

/** Stored photo extension per allowed MIME type (matches the server's uploads.ts). */
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Settings for a fake API. */
export interface FakeApiOptions {
  /** How long each answer waits, so loading states show as they would on a real network. */
  delayMs?: number;
  /** Shrinks an uploaded photo; rejects if the bytes aren't a readable image. */
  shrinkPhoto: (file: Blob) => Promise<Blob>;
}

/** A fake API bound to one store. */
export interface FakeApi {
  /**
   * Answers one request the way the server would.
   * @param method - the HTTP method.
   * @param url - the full request URL (only the path is used).
   * @param init - the fetch options, for the body and headers.
   * @returns the response.
   */
  handle(method: string, url: URL, init?: RequestInit): Promise<Response>;
}

/**
 * A JSON response.
 * @param status - the HTTP status.
 * @param body - the value to send as JSON.
 * @returns the response.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * An error response in the server's `{ error }` shape.
 * @param status - the HTTP status.
 * @param message - the error message.
 * @returns the response.
 */
function error(status: number, message: string): Response {
  return json(status, { error: message });
}

/** The part of a shared Zod schema the fake API uses (the web app doesn't depend on Zod itself). */
interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
}

/** A `204 No Content` response. */
function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** The bare 404 the server's photo route sends (Express's `sendStatus(404)`). */
function bareNotFound(): Response {
  return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * Validates a request body with a shared schema, the way the server's routes do.
 * @param schema - the shared Zod schema.
 * @param body - the parsed request body (undefined when there was none).
 * @returns the parsed data, or a 400 response with the joined Zod messages.
 */
function validate<T>(schema: Schema<T>, body: unknown): { data: T } | { response: Response } {
  const parsed = schema.safeParse(body);
  // Same message format as the server: every issue's message, comma-separated.
  if (!parsed.success) {
    return { response: error(400, parsed.error.issues.map((issue) => issue.message).join(", ")) };
  }
  return { data: parsed.data };
}

/**
 * Reads a JSON request body the way `express.json()` does: only when the request says it's JSON.
 * @param init - the fetch options.
 * @returns the parsed body, or undefined when there's no JSON body.
 */
function jsonBody(init: RequestInit | undefined): unknown {
  const contentType = new Headers(init?.headers).get("Content-Type") ?? "";
  // express.json() ignores bodies that aren't sent as JSON, leaving req.body undefined.
  if (!contentType.includes("application/json") || typeof init?.body !== "string") return undefined;
  return JSON.parse(init.body);
}

/**
 * Creates a fake API over a store.
 * @param store - the in-memory data it reads and writes.
 * @param options - the delay and photo shrinker.
 * @returns the fake API.
 */
export function createFakeApi(store: DemoStore, options: FakeApiOptions): FakeApi {
  /**
   * The API shape of a stored Person, marking "You".
   * @param person - the stored Person.
   * @returns the API Person.
   */
  function toPerson(person: DemoPerson): Person {
    return { ...person, isPrimary: person.id === store.primaryPersonId };
  }

  /**
   * Finds a Person by id. The demo's one User owns every Person, so "viewable", "editable" and
   * "owned" (the server's three access checks) all mean "exists".
   * @param id - the Person's id.
   * @returns the Person, or undefined.
   */
  function findPerson(id: string): DemoPerson | undefined {
    return store.people.find((person) => person.id === id);
  }

  /**
   * Removes a photo from the photo store, if the path points at one.
   * @param profilePicturePath - "uploads/<file>", or null.
   */
  function deletePhoto(profilePicturePath: string | null): void {
    // No photo on record: nothing to remove.
    if (!profilePicturePath) return;
    store.photos.delete(profilePicturePath.slice("uploads/".length));
  }

  /**
   * Removes a Person and everything hanging off them (visits cascade on the server; the photo
   * file is cleaned up after).
   * @param id - the Person to remove.
   */
  function removePerson(id: string): void {
    const person = findPerson(id);
    store.people = store.people.filter((candidate) => candidate.id !== id);
    store.states.delete(id);
    store.countries.delete(id);
    deletePhoto(person?.profilePicturePath ?? null);
  }

  /** `GET /api/people/allowance`. */
  function allowance(): Response {
    const body: PeopleAllowance = { owned: store.people.length, max: MAX_PEOPLE_PER_USER };
    return json(200, body);
  }

  /**
   * `POST /api/people`.
   * @param init - the request, for its JSON body.
   * @returns the created Person (201), a 400 for bad input, or a 409 at the cap.
   */
  function createPerson(init: RequestInit | undefined): Response {
    const result = validate(createPersonSchema, jsonBody(init));
    // Bad body (missing name, bad color): the server's 400.
    if ("response" in result) return result.response;
    // At the per-User cap: the server refuses with the shared message.
    if (store.people.length >= MAX_PEOPLE_PER_USER) return error(409, PEOPLE_CAP_MESSAGE);

    const person: DemoPerson = {
      id: newId(store, "person"),
      name: result.data.name,
      colorHex: result.data.colorHex,
      profilePicturePath: null,
      createdAt: new Date().toISOString(),
    };
    store.people.push(person);
    store.states.set(person.id, new Set());
    store.countries.set(person.id, new Set());
    return json(201, toPerson(person));
  }

  /**
   * `PATCH /api/people/:id`.
   * @param person - the Person (already found).
   * @param init - the request, for its JSON body.
   * @returns the updated Person, or a 400 for bad input.
   */
  function updatePerson(person: DemoPerson, init: RequestInit | undefined): Response {
    const result = validate(updatePersonSchema, jsonBody(init));
    // Bad body (empty name, bad color): the server's 400, and nothing changes.
    if ("response" in result) return result.response;
    // Only the fields that were sent change; the parsed name is already trimmed.
    if (result.data.name !== undefined) person.name = result.data.name;
    if (result.data.colorHex !== undefined) person.colorHex = result.data.colorHex;
    return json(200, toPerson(person));
  }

  /**
   * `DELETE /api/people/:id`.
   * @param person - the Person (already found).
   * @returns 204, or a 409 for the Primary Person.
   */
  function deletePerson(person: DemoPerson): Response {
    // "You" only goes with the whole account, which the demo doesn't have.
    if (person.id === store.primaryPersonId) {
      return error(409, "This is you, so it can't be deleted. To remove it, delete your account.");
    }
    removePerson(person.id);
    return noContent();
  }

  /**
   * `POST /api/people/:id/photo`. Checks run in the server's order: the file's type, its size,
   * whether there was a file at all, then whether it decodes.
   * @param person - the Person (already found).
   * @param init - the request, for its multipart body.
   * @returns the updated Person, or a 400 with the server's message.
   */
  async function uploadPhoto(person: DemoPerson, init: RequestInit | undefined): Promise<Response> {
    const form = init?.body instanceof FormData ? init.body : null;
    // Multer accepts exactly one file field, named "photo"; any other file field is refused.
    const strayFile = form && [...form.entries()].some(([name, value]) => name !== "photo" && typeof value !== "string");
    if (strayFile) return error(400, "Unexpected field");

    const file = form?.get("photo");
    // A file of a type the server doesn't take is refused before anything else.
    if (file instanceof Blob && !(ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
      return error(400, "Photo must be JPEG, PNG, or WebP.");
    }
    // Over the size limit: multer's own message.
    if (file instanceof Blob && file.size > MAX_PHOTO_SIZE_BYTES) return error(400, "File too large");
    // No file in the body at all (not multipart, or no "photo" field).
    if (!(file instanceof Blob)) return error(400, "No photo uploaded");

    let shrunk: Blob;
    try {
      shrunk = await options.shrinkPhoto(file);
    } catch {
      // Claimed to be an image but couldn't be decoded.
      return error(400, "Photo couldn't be read as an image.");
    }

    const fileName = `${newId(store, "photo")}${EXTENSION_BY_MIME_TYPE[file.type]}`;
    // The replaced photo has no owner any more, so it goes (the server's GET would 404 it anyway).
    deletePhoto(person.profilePicturePath);
    store.photos.set(fileName, shrunk);
    person.profilePicturePath = `uploads/${fileName}`;
    return json(200, toPerson(person));
  }

  /**
   * `POST /api/people/:id/claim` ("Set as me"): the old Primary Person's visits that the target
   * lacks are merged into it, the target becomes "You", and the old Primary Person is removed.
   * @param target - the Person to Claim (already found).
   * @returns the Claimed Person, or a 409 if it's already "You".
   */
  function claim(target: DemoPerson): Response {
    // Claiming who you already are changes nothing — refuse rather than delete yourself.
    if (target.id === store.primaryPersonId) return error(409, "This is already you.");

    const oldPrimaryId = store.primaryPersonId;
    // Merge: add each of the old Primary Person's states and countries to the target's sets
    // (a Set ignores ones the target already has).
    for (const code of store.states.get(oldPrimaryId) ?? []) store.states.get(target.id)!.add(code);
    for (const code of store.countries.get(oldPrimaryId) ?? []) store.countries.get(target.id)!.add(code);

    store.primaryPersonId = target.id;
    removePerson(oldPrimaryId);
    return json(200, toPerson(target));
  }

  /**
   * The per-Person visits routes, shared by states and countries (the server's visits.ts and
   * countries.ts mirror each other the same way).
   * @param method - the HTTP method.
   * @param visits - this Person's visited codes.
   * @param code - the code from the path, or undefined for the list route.
   * @param knownCodes - every valid code.
   * @param unknownMessage - the 400 message for a code that isn't in `knownCodes`.
   * @returns the response, or null if the method/path pair isn't a route.
   */
  function visitsRoute(
    method: string,
    visits: Set<string>,
    code: string | undefined,
    knownCodes: string[],
    unknownMessage: string,
  ): Response | null {
    // GET on the collection: the visited codes.
    if (code === undefined) return method === "GET" ? json(200, [...visits]) : null;
    const normalized = code.toUpperCase();
    // PUT marks a place visited; unknown codes are refused, repeats are a no-op.
    if (method === "PUT") {
      if (!knownCodes.includes(normalized)) return error(400, unknownMessage);
      visits.add(normalized);
      return noContent();
    }
    // DELETE unmarks it; unknown or unvisited codes are a no-op, like the server's deleteMany.
    if (method === "DELETE") {
      visits.delete(normalized);
      return noContent();
    }
    return null;
  }

  /**
   * The bulk map routes (`GET /api/visits`, `GET /api/countries`): one entry per Person with at
   * least one visit, ordered by Person id like the server's query.
   * @param byPerson - person id → visited codes.
   * @param key - the field name for the codes ("stateCodes" or "countryCodes").
   * @returns the response.
   */
  function bulkRoute(byPerson: Map<string, Set<string>>, key: "stateCodes" | "countryCodes"): Response {
    // Keep People with visits, sort by id as the server does, and shape each entry.
    const entries = [...byPerson]
      .filter(([, codes]) => codes.size > 0)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([personId, codes]) => ({ personId, [key]: [...codes] }));
    return json(200, entries);
  }

  /**
   * `GET /uploads/:file`: a photo some Person uses, else the server's bare 404.
   * @param segments - the path's parts after "uploads".
   * @returns the response.
   */
  async function servePhoto(segments: string[]): Promise<Response> {
    // Only a single file name is a photo; nested paths and the bare folder are not found.
    if (segments.length !== 1) return bareNotFound();
    const [fileName] = segments;
    const inUse = store.people.some((person) => person.profilePicturePath === `uploads/${fileName}`);
    const blob = store.photos.get(fileName);
    // Not used by any Person, or not there: both look the same to the caller.
    if (!inUse || !blob) return bareNotFound();
    return new Response(await blob.arrayBuffer(), {
      status: 200,
      headers: { "Content-Type": blob.type, "Cache-Control": "private, no-cache" },
    });
  }

  /**
   * Routes one /api request. Mirrors app.ts's mounts and each router's paths.
   * @param method - the HTTP method.
   * @param segments - the path's parts after "api".
   * @param init - the fetch options.
   * @returns the response, or null if no route matches.
   */
  async function routeApi(method: string, segments: string[], init: RequestInit | undefined): Promise<Response | null> {
    const [first, id, sub, code, ...rest] = segments;
    // Every route below has at most four parts after /api.
    if (rest.length > 0) return null;

    switch (first) {
      case "health":
        return method === "GET" && id === undefined ? json(200, { status: "ok" }) : null;

      case "me": {
        // GET /api/me: the Guest, who always has a Primary Person (so no welcome step).
        if (method === "GET" && id === undefined) {
          const body: CurrentUserResponse = { user: GUEST_USER, primaryPersonId: store.primaryPersonId };
          return json(200, body);
        }
        // POST /api/me/primary-person: the welcome step, already done in the demo.
        if (method === "POST" && id === "primary-person" && sub === undefined) {
          const result = validate(createPersonSchema, jsonBody(init));
          if ("response" in result) return result.response;
          return error(409, "You already have a Primary Person.");
        }
        return null;
      }

      case "visits":
        return method === "GET" && id === undefined ? bulkRoute(store.states, "stateCodes") : null;

      case "countries":
        return method === "GET" && id === undefined ? bulkRoute(store.countries, "countryCodes") : null;

      case "people": {
        // The collection: list and create.
        if (id === undefined) {
          if (method === "GET") return json(200, store.people.map(toPerson));
          if (method === "POST") return createPerson(init);
          return null;
        }
        // GET /api/people/allowance is matched before the :id routes, as on the server.
        if (id === "allowance" && method === "GET" && sub === undefined) return allowance();

        // Work out whether this method/path is a route before checking the Person, so an
        // unknown route stays "not available" rather than "Person not found".
        const isPersonRoute = sub === undefined && (method === "PATCH" || method === "DELETE");
        const isActionRoute = (sub === "photo" || sub === "claim") && code === undefined && method === "POST";
        const isVisitsRoute =
          (sub === "visits" || sub === "countries") &&
          (code === undefined ? method === "GET" : method === "PUT" || method === "DELETE");
        if (!isPersonRoute && !isActionRoute && !isVisitsRoute) return null;

        const person = findPerson(id);
        // The server's access check runs first on every :id route: a missing Person is a 404.
        if (!person) return error(404, "Person not found");

        // Dispatch to the handler for this sub-route.
        if (sub === undefined) return method === "PATCH" ? updatePerson(person, init) : deletePerson(person);
        if (sub === "photo") return uploadPhoto(person, init);
        if (sub === "claim") return claim(person);
        if (sub === "visits") return visitsRoute(method, store.states.get(person.id)!, code, US_STATE_CODES, "Unknown state code");
        return visitsRoute(method, store.countries.get(person.id)!, code, COUNTRY_CODES, "Unknown country code");
      }

      default:
        return null;
    }
  }

  return {
    async handle(method, url, init) {
      // Wait first, so every answer (errors included) takes as long as a real round trip.
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));

      const upperMethod = method.toUpperCase();
      // Split the path into decoded parts, ignoring empty ones (Express ignores a trailing slash).
      const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const [root, ...rest] = segments;

      // Photos are only ever read.
      if (root === "uploads") return upperMethod === "GET" ? servePhoto(rest) : bareNotFound();
      // Anything outside /api and /uploads isn't the API's business.
      if (root !== "api") return error(404, NOT_AVAILABLE);

      return (await routeApi(upperMethod, rest, init)) ?? error(404, NOT_AVAILABLE);
    },
  };
}
