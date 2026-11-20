import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeApi, GUEST_USER, NOT_AVAILABLE, type FakeApiOptions } from "./fakeApi";
import { DEMO_SEED } from "./seed";
import { createStore } from "./store";

// Behavior only the demo has. Everything the server also does is covered by the API contract
// scenarios (apiContract.test.ts), which run against both.

/**
 * A fake API over a fresh seed store.
 * @param options - overrides for the delay and photo shrinker.
 * @returns the store and a `call` helper that returns status and parsed body.
 */
function setup(options: Partial<FakeApiOptions> = {}) {
  const store = createStore(DEMO_SEED);
  const api = createFakeApi(store, { shrinkPhoto: async (file) => file, ...options });

  /**
   * Sends one request.
   * @param method - the HTTP method.
   * @param path - the request path.
   * @param init - extra fetch options.
   * @returns the raw response.
   */
  function call(method: string, path: string, init?: RequestInit) {
    return api.handle(method, new URL(path, "http://demo.test"), { method, ...init });
  }
  return { store, call };
}

/**
 * A multipart body holding one file.
 * @param field - the form field name.
 * @param file - the file.
 * @returns the form.
 */
function form(field: string, file: File): RequestInit {
  const body = new FormData();
  body.append(field, file);
  return { body };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the fake API, demo-only behavior", () => {
  it("answers /api/me with the Guest and the seed's Primary Person", async () => {
    const { store, call } = setup();
    const res = await call("GET", "/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: GUEST_USER, primaryPersonId: store.primaryPersonId });
  });

  it.each([
    ["GET", "/api/auth/microsoft"],
    ["POST", "/api/auth/signout"],
    ["DELETE", "/api/me"],
    ["GET", "/api/people/some-id"],
    ["GET", "/api/nothing-here"],
    ["GET", "/api/people/x/visits/CA/extra"],
  ])("answers %s %s as not available", async (method, path) => {
    const res = await setup().call(method, path);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: NOT_AVAILABLE });
  });

  it("serves a seed photo, and 404s any photo nobody uses", async () => {
    const { call } = setup();
    const photo = await call("GET", "/uploads/demo-seed-marge.svg");
    expect(photo.status).toBe(200);
    expect(photo.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await photo.text()).toContain("<svg");

    for (const path of ["/uploads/nope.png", "/uploads/a/b.png"]) {
      const missing = await call("GET", path);
      expect(missing.status).toBe(404);
      expect(await missing.text()).toBe("Not Found");
    }
  });

  it("drops a replaced photo and a deleted Person's photo", async () => {
    const { store, call } = setup();
    const marge = store.people[1];
    const upload = await call("POST", `/api/people/${marge.id}/photo`, form("photo", new File(["x"], "a.png", { type: "image/png" })));
    const { profilePicturePath } = await upload.json();
    expect(profilePicturePath).toMatch(/^uploads\/demo-photo-\d+\.png$/);
    expect(store.photos.has("demo-seed-marge.svg")).toBe(false);
    expect((await call("GET", "/uploads/demo-seed-marge.svg")).status).toBe(404);

    await call("DELETE", `/api/people/${marge.id}`);
    expect(store.photos.size).toBe(1); // only Lisa's seed photo is left
  });

  it("says an undecodable photo couldn't be read, and keeps the old one", async () => {
    const { store, call } = setup({ shrinkPhoto: () => Promise.reject(new Error("bad bytes")) });
    const lisa = store.people[3];
    const res = await call("POST", `/api/people/${lisa.id}/photo`, form("photo", new File(["x"], "a.jpg", { type: "image/jpeg" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Photo couldn't be read as an image." });
    expect(lisa.profilePicturePath).toBe("uploads/demo-seed-lisa.svg");
  });

  it("refuses a file sent under any field but photo", async () => {
    const { store, call } = setup();
    const res = await call("POST", `/api/people/${store.people[0].id}/photo`, form("avatar", new File(["x"], "a.png", { type: "image/png" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unexpected field" });
  });

  it("removes a claimed-away You's photo", async () => {
    const { store, call } = setup();
    const [homer, marge] = store.people;
    await call("POST", `/api/people/${homer.id}/photo`, form("photo", new File(["x"], "a.png", { type: "image/png" })));
    const homerPhoto = homer.profilePicturePath!.slice("uploads/".length);

    await call("POST", `/api/people/${marge.id}/claim`);
    expect(store.primaryPersonId).toBe(marge.id);
    expect(store.photos.has(homerPhoto)).toBe(false);
  });

  it("waits the configured delay before answering", async () => {
    vi.useFakeTimers();
    const { call } = setup({ delayMs: 150 });
    let answered = false;
    const pending = call("GET", "/api/people").then(() => {
      answered = true;
    });
    await vi.advanceTimersByTimeAsync(149);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(answered).toBe(true);
  });
});
