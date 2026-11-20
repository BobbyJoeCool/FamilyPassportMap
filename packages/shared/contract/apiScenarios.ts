import { expect } from "vitest";
import {
  createPersonSchema,
  MAX_PEOPLE_PER_USER,
  MAX_PHOTO_SIZE_BYTES,
  PEOPLE_CAP_MESSAGE,
  updatePersonSchema,
} from "@familypassportmap/shared";

// The API contract: one set of scenarios that runs against the real server (through Supertest, in
// apps/server/tests/apiContract.test.ts) and against the guest demo's fake API (in
// apps/web/src/demo/apiContract.test.ts). Both runs check the same statuses and bodies, so the
// demo can't quietly drift from the server's rules. A new API route needs a scenario here and a
// handler in the fake API.
//
// Ids and timestamps differ between the two (cuid vs. "demo-person-N"), so scenarios check their
// shape and compare everything else exactly.

/** One response, reduced to what the contract compares. */
export interface ContractResponse {
  status: number;
  /** The parsed JSON body, or null when the response isn't JSON (or is empty). */
  body: unknown;
  /** The raw body text for non-JSON responses (e.g. "Not Found"), else null. */
  text: string | null;
  contentType: string | null;
  cacheControl: string | null;
}

/** A file to upload in a multipart body. */
export interface ContractFile {
  /** The form field; the API expects "photo". */
  field: string;
  name: string;
  type: string;
  bytes: Uint8Array;
}

/** Something that can send API requests: the real server, or the fake API. */
export interface ContractClient {
  /**
   * Sends one request.
   * @param method - the HTTP method.
   * @param path - the request path, e.g. "/api/people".
   * @param options - a JSON body, or a file for a multipart upload (never both).
   * @returns the reduced response.
   */
  request(method: string, path: string, options?: { json?: unknown; file?: ContractFile }): Promise<ContractResponse>;
}

/**
 * Each scenario starts with a fresh client whose User has finished the welcome step and has only
 * their Primary Person, `CONTRACT_PRIMARY`, with no visits and no photo.
 */
export const CONTRACT_PRIMARY = { name: "Me", colorHex: "#112233" };

/** One contract scenario. */
export interface ContractScenario {
  name: string;
  run(client: ContractClient): Promise<void>;
}

/** The smallest valid PNG: one transparent pixel. */
const ONE_PIXEL_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

/** An id the API never hands out. */
const MISSING_ID = "no-such-person";

/** An API Person, as far as the contract can compare it. */
interface PersonBody {
  id: string;
  name: string;
  colorHex: string;
  profilePicturePath: string | null;
  createdAt: string;
  isPrimary: boolean;
}

/**
 * The error message the server builds from a shared schema for a bad body: every Zod issue's
 * message, comma-separated. Computed from the same schema both sides use.
 * @param schema - the shared schema.
 * @param input - the bad body.
 * @returns the expected `error` text.
 */
function schemaError(schema: typeof createPersonSchema | typeof updatePersonSchema, input: unknown): string {
  const parsed = schema.safeParse(input);
  // Guards the scenario itself: an input that passes would make a meaningless check.
  if (parsed.success) throw new Error("schemaError was given a valid input");
  return parsed.error.issues.map((issue) => issue.message).join(", ");
}

/**
 * Checks a Person body's shape and returns it typed: an id string, an ISO timestamp, and the
 * expected comparable fields.
 * @param body - the response body.
 * @param expected - the fields that must match exactly.
 * @returns the body as a Person.
 */
function expectPerson(body: unknown, expected: Omit<PersonBody, "id" | "createdAt">): PersonBody {
  const person = body as PersonBody;
  expect(person).toEqual({ ...expected, id: expect.any(String), createdAt: expect.any(String) });
  expect(new Date(person.createdAt).toISOString()).toBe(person.createdAt);
  return person;
}

/**
 * Sends a request and checks its status (and optionally its exact JSON body).
 * @param client - the API under test.
 * @param method - the HTTP method.
 * @param path - the request path.
 * @param status - the expected status.
 * @param options - the request body, and the exact body to expect.
 * @returns the response.
 */
async function expectCall(
  client: ContractClient,
  method: string,
  path: string,
  status: number,
  options: { json?: unknown; file?: ContractFile; body?: unknown } = {},
): Promise<ContractResponse> {
  const res = await client.request(method, path, { json: options.json, file: options.file });
  expect({ method, path, status: res.status }).toEqual({ method, path, status });
  // Only compare the body when the scenario names one.
  if ("body" in options) expect(res.body).toEqual(options.body);
  return res;
}

/**
 * The client's People, as returned by the list route.
 * @param client - the API under test.
 * @returns the People, oldest first.
 */
async function listPeople(client: ContractClient): Promise<PersonBody[]> {
  return (await expectCall(client, "GET", "/api/people", 200)).body as PersonBody[];
}

/**
 * The Primary Person every scenario starts with.
 * @param client - the API under test.
 * @returns "Me".
 */
async function primaryPerson(client: ContractClient): Promise<PersonBody> {
  const [me] = await listPeople(client);
  return me;
}

/**
 * Creates a Person and checks the 201.
 * @param client - the API under test.
 * @param name - the new Person's name.
 * @param colorHex - their color.
 * @returns the new Person.
 */
async function createPerson(client: ContractClient, name: string, colorHex = "#AABBCC"): Promise<PersonBody> {
  const res = await expectCall(client, "POST", "/api/people", 201, { json: { name, colorHex } });
  return res.body as PersonBody;
}

/**
 * A bulk map response keyed by Person name, with codes sorted, so both sides compare without ids.
 * @param client - the API under test.
 * @param path - "/api/visits" or "/api/countries".
 * @param key - the codes field in each entry.
 * @returns name → sorted codes.
 */
async function bulkByName(client: ContractClient, path: string, key: "stateCodes" | "countryCodes"): Promise<Record<string, string[]>> {
  const people = await listPeople(client);
  const nameOf = new Map(people.map((person) => [person.id, person.name]));
  const entries = (await expectCall(client, "GET", path, 200)).body as Array<Record<string, unknown>>;
  // Each entry becomes name → its codes, sorted (row order isn't part of the contract).
  return Object.fromEntries(
    entries.map((entry) => [nameOf.get(entry.personId as string), [...(entry[key] as string[])].sort()]),
  );
}

/**
 * One Person's visited codes, sorted.
 * @param client - the API under test.
 * @param personId - whose visits.
 * @param kind - "visits" (states) or "countries".
 * @returns the sorted codes.
 */
async function codesOf(client: ContractClient, personId: string, kind: "visits" | "countries"): Promise<string[]> {
  const res = await expectCall(client, "GET", `/api/people/${personId}/${kind}`, 200);
  return [...(res.body as string[])].sort();
}

/**
 * The per-Person visit routes, shared by states and countries.
 * @param kind - "visits" or "countries".
 * @param code - a valid code, sent lowercase to check normalizing.
 * @param badCode - a code the API must refuse.
 * @param unknownMessage - the refusal's message.
 * @returns the scenario's run function.
 */
function visitScenario(kind: "visits" | "countries", code: string, badCode: string, unknownMessage: string) {
  return async (client: ContractClient) => {
    const me = await primaryPerson(client);
    const base = `/api/people/${me.id}/${kind}`;
    await expectCall(client, "GET", base, 200, { body: [] });
    await expectCall(client, "PUT", `${base}/${code.toLowerCase()}`, 204);
    await expectCall(client, "PUT", `${base}/${code}`, 204);
    await expectCall(client, "PUT", `${base}/${badCode}`, 400, { body: { error: unknownMessage } });
    await expectCall(client, "GET", base, 200, { body: [code] });
    await expectCall(client, "DELETE", `${base}/${code.toLowerCase()}`, 204);
    await expectCall(client, "DELETE", `${base}/${badCode}`, 204);
    await expectCall(client, "GET", base, 200, { body: [] });
    // A missing Person is a 404 on every route, checked before the code.
    for (const [method, path] of [
      ["GET", `/api/people/${MISSING_ID}/${kind}`],
      ["PUT", `/api/people/${MISSING_ID}/${kind}/${badCode}`],
      ["DELETE", `/api/people/${MISSING_ID}/${kind}/${code}`],
    ]) {
      await expectCall(client, method, path, 404, { body: { error: "Person not found" } });
    }
  };
}

export const apiScenarios: ContractScenario[] = [
  {
    name: "lists the Primary Person as You, and /api/me points at them",
    async run(client) {
      const people = await listPeople(client);
      expect(people).toHaveLength(1);
      const me = expectPerson(people[0], { ...CONTRACT_PRIMARY, profilePicturePath: null, isPrimary: true });
      const current = await expectCall(client, "GET", "/api/me", 200);
      expect((current.body as { primaryPersonId: string }).primaryPersonId).toBe(me.id);
      await expectCall(client, "GET", "/api/health", 200, { body: { status: "ok" } });
    },
  },
  {
    name: "creates a Person with a trimmed name, listed after You",
    async run(client) {
      const res = await expectCall(client, "POST", "/api/people", 201, { json: { name: "  Ann  ", colorHex: "#aabbcc" } });
      expectPerson(res.body, { name: "Ann", colorHex: "#aabbcc", profilePicturePath: null, isPrimary: false });
      expect((await listPeople(client)).map((person) => [person.name, person.isPrimary])).toEqual([
        ["Me", true],
        ["Ann", false],
      ]);
    },
  },
  {
    name: "refuses bad new-Person input with the shared validation messages",
    async run(client) {
      // Each bad body, including none at all, gets the server's joined Zod messages.
      for (const json of [{ name: "", colorHex: "#12" }, { colorHex: "#112233" }, { name: "Ann", colorHex: "red" }, undefined]) {
        await expectCall(client, "POST", "/api/people", 400, { json, body: { error: schemaError(createPersonSchema, json) } });
      }
      // The welcome step is already done, whatever the body.
      await expectCall(client, "POST", "/api/me/primary-person", 409, {
        json: { name: "Again", colorHex: "#000000" },
        body: { error: "You already have a Primary Person." },
      });
      expect(await listPeople(client)).toHaveLength(1);
    },
  },
  {
    name: "renames and recolors, refuses bad edits, and 404s a missing Person first",
    async run(client) {
      const ann = await createPerson(client, "Ann");
      const renamed = await expectCall(client, "PATCH", `/api/people/${ann.id}`, 200, { json: { name: " Bea " } });
      expectPerson(renamed.body, { name: "Bea", colorHex: "#AABBCC", profilePicturePath: null, isPrimary: false });
      const recolored = await expectCall(client, "PATCH", `/api/people/${ann.id}`, 200, { json: { colorHex: "#000000" } });
      expectPerson(recolored.body, { name: "Bea", colorHex: "#000000", profilePicturePath: null, isPrimary: false });
      const unchanged = await expectCall(client, "PATCH", `/api/people/${ann.id}`, 200, { json: {} });
      expect((unchanged.body as PersonBody).name).toBe("Bea");

      // Each bad edit gets the shared message and changes nothing.
      for (const json of [{ name: "   " }, { colorHex: "#GGGGGG" }]) {
        await expectCall(client, "PATCH", `/api/people/${ann.id}`, 400, { json, body: { error: schemaError(updatePersonSchema, json) } });
      }
      expect((await listPeople(client))[1]).toMatchObject({ name: "Bea", colorHex: "#000000" });

      await expectCall(client, "PATCH", `/api/people/${MISSING_ID}`, 404, { json: { name: "" }, body: { error: "Person not found" } });
    },
  },
  {
    name: `caps a User at ${MAX_PEOPLE_PER_USER} People, counting You`,
    async run(client) {
      await expectCall(client, "GET", "/api/people/allowance", 200, { body: { owned: 1, max: MAX_PEOPLE_PER_USER } });
      const created: PersonBody[] = [];
      // Fill up to the cap: You plus nine more.
      for (let i = 1; i < MAX_PEOPLE_PER_USER; i++) created.push(await createPerson(client, `P${i}`));
      await expectCall(client, "GET", "/api/people/allowance", 200, { body: { owned: MAX_PEOPLE_PER_USER, max: MAX_PEOPLE_PER_USER } });
      await expectCall(client, "POST", "/api/people", 409, { json: { name: "One too many", colorHex: "#000000" }, body: { error: PEOPLE_CAP_MESSAGE } });
      // The cap is checked after validation: a bad body at the cap is still a 400.
      await expectCall(client, "POST", "/api/people", 400, { json: { name: "" , colorHex: "#000000" } });

      await expectCall(client, "DELETE", `/api/people/${created[0].id}`, 204);
      await createPerson(client, "Room again");
    },
  },
  {
    name: "won't delete You, 404s a missing Person, and deletes anyone else with their visits",
    async run(client) {
      const me = await primaryPerson(client);
      await expectCall(client, "DELETE", `/api/people/${me.id}`, 409, {
        body: { error: "This is you, so it can't be deleted. To remove it, delete your account." },
      });
      await expectCall(client, "DELETE", `/api/people/${MISSING_ID}`, 404, { body: { error: "Person not found" } });

      const ann = await createPerson(client, "Ann");
      await expectCall(client, "PUT", `/api/people/${ann.id}/visits/CA`, 204);
      await expectCall(client, "DELETE", `/api/people/${ann.id}`, 204);
      await expectCall(client, "GET", `/api/people/${ann.id}/visits`, 404, { body: { error: "Person not found" } });
      expect(await bulkByName(client, "/api/visits", "stateCodes")).toEqual({});
      expect((await listPeople(client)).map((person) => person.name)).toEqual(["Me"]);
    },
  },
  { name: "marks and unmarks states", run: visitScenario("visits", "CA", "XX", "Unknown state code") },
  { name: "marks and unmarks countries (territories refused)", run: visitScenario("countries", "FR", "PR", "Unknown country code") },
  {
    name: "bulk maps list each Person with visits, and skip People without",
    async run(client) {
      const me = await primaryPerson(client);
      const ann = await createPerson(client, "Ann");
      await createPerson(client, "Ben");
      for (const code of ["CA", "TX"]) await expectCall(client, "PUT", `/api/people/${me.id}/visits/${code}`, 204);
      await expectCall(client, "PUT", `/api/people/${ann.id}/visits/NY`, 204);
      await expectCall(client, "PUT", `/api/people/${ann.id}/countries/JP`, 204);

      expect(await bulkByName(client, "/api/visits", "stateCodes")).toEqual({ Me: ["CA", "TX"], Ann: ["NY"] });
      expect(await bulkByName(client, "/api/countries", "countryCodes")).toEqual({ Ann: ["JP"] });
    },
  },
  {
    name: "Set as me merges the old You's visits into the chosen Person and removes the old You",
    async run(client) {
      const me = await primaryPerson(client);
      const ann = await createPerson(client, "Ann");
      for (const code of ["CA", "TX"]) await expectCall(client, "PUT", `/api/people/${me.id}/visits/${code}`, 204);
      await expectCall(client, "PUT", `/api/people/${me.id}/countries/FR`, 204);
      for (const code of ["TX", "NY"]) await expectCall(client, "PUT", `/api/people/${ann.id}/visits/${code}`, 204);
      await expectCall(client, "PUT", `/api/people/${ann.id}/countries/JP`, 204);

      const claimed = await expectCall(client, "POST", `/api/people/${ann.id}/claim`, 200);
      expectPerson(claimed.body, { name: "Ann", colorHex: "#AABBCC", profilePicturePath: null, isPrimary: true });
      expect((claimed.body as PersonBody).id).toBe(ann.id);

      const people = await listPeople(client);
      expect(people.map((person) => [person.name, person.isPrimary])).toEqual([["Ann", true]]);
      expect(await codesOf(client, ann.id, "visits")).toEqual(["CA", "NY", "TX"]);
      expect(await codesOf(client, ann.id, "countries")).toEqual(["FR", "JP"]);
      const current = await expectCall(client, "GET", "/api/me", 200);
      expect((current.body as { primaryPersonId: string }).primaryPersonId).toBe(ann.id);
      await expectCall(client, "GET", `/api/people/${me.id}/visits`, 404, { body: { error: "Person not found" } });

      await expectCall(client, "POST", `/api/people/${ann.id}/claim`, 409, { body: { error: "This is already you." } });
      await expectCall(client, "POST", `/api/people/${MISSING_ID}/claim`, 404, { body: { error: "Person not found" } });
      // The new You can't be deleted either.
      await expectCall(client, "DELETE", `/api/people/${ann.id}`, 409);
    },
  },
  {
    name: "refuses bad photo uploads with the server's messages",
    async run(client) {
      const me = await primaryPerson(client);
      const path = `/api/people/${me.id}/photo`;
      const png = (bytes: Uint8Array, type = "image/png"): ContractFile => ({ field: "photo", name: "photo.png", type, bytes });

      await expectCall(client, "POST", `/api/people/${MISSING_ID}/photo`, 404, { file: png(ONE_PIXEL_PNG), body: { error: "Person not found" } });
      await expectCall(client, "POST", path, 400, {
        file: { field: "photo", name: "notes.txt", type: "text/plain", bytes: new Uint8Array([104, 105]) },
        body: { error: "Photo must be JPEG, PNG, or WebP." },
      });
      await expectCall(client, "POST", path, 400, { file: png(new Uint8Array(MAX_PHOTO_SIZE_BYTES + 1)), body: { error: "File too large" } });
      await expectCall(client, "POST", path, 400, { json: {}, body: { error: "No photo uploaded" } });
      expect((await primaryPerson(client)).profilePicturePath).toBeNull();
    },
  },
  {
    name: "stores an uploaded photo and serves it only at its own path",
    async run(client) {
      const me = await primaryPerson(client);
      const res = await expectCall(client, "POST", `/api/people/${me.id}/photo`, 200, {
        file: { field: "photo", name: "me.png", type: "image/png", bytes: ONE_PIXEL_PNG },
      });
      const person = expectPerson(res.body, {
        ...CONTRACT_PRIMARY,
        profilePicturePath: expect.stringMatching(/^uploads\/[\w-]+\.png$/),
        isPrimary: true,
      });

      const photo = await expectCall(client, "GET", `/${person.profilePicturePath}`, 200);
      expect(photo.contentType).toBe("image/png");
      expect(photo.cacheControl).toBe("private, no-cache");

      // Any other path is the same bare 404, whether or not the file could exist.
      for (const missing of ["/uploads/not-a-photo.png", "/uploads/a/b.png"]) {
        const res404 = await expectCall(client, "GET", missing, 404);
        expect(res404.text).toBe("Not Found");
      }
    },
  },
];
