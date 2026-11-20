import { afterEach, describe, expect, it, vi } from "vitest";
import { photoUrl, setPhotoUrlResolver } from "../api/photos";
import type { FakeApi } from "./fakeApi";
import { createDemoFetch, demoPhotoUrls, isFakeApiRequest } from "./install";
import { DEMO_SEED } from "./seed";
import { createStore } from "./store";

afterEach(() => {
  setPhotoUrlResolver(null);
});

describe("createDemoFetch", () => {
  /**
   * A demo fetch over stand-ins for the fake API and the real fetch.
   * @returns the demo fetch and both stand-ins.
   */
  function setup() {
    const handle = vi.fn(async () => new Response("fake"));
    const realFetch = vi.fn(async () => new Response("real"));
    const demoFetch = createDemoFetch({ handle } as FakeApi, realFetch as unknown as typeof fetch);
    return { handle, realFetch, demoFetch };
  }

  it("sends /api and /uploads requests to the fake API, with method and body", async () => {
    const { handle, realFetch, demoFetch } = setup();
    await demoFetch("/api/people", { method: "POST", body: "{}" });
    await demoFetch("/uploads/demo-photo-1.png");
    expect(realFetch).not.toHaveBeenCalled();
    expect(handle).toHaveBeenNthCalledWith(1, "POST", new URL("/api/people", window.location.href), { method: "POST", body: "{}" });
    expect(handle).toHaveBeenNthCalledWith(2, "GET", new URL("/uploads/demo-photo-1.png", window.location.href), undefined);
  });

  it("sends everything else to the real fetch", async () => {
    const { handle, realFetch, demoFetch } = setup();
    await demoFetch("/assets/index.js");
    await demoFetch("https://example.com/api/people");
    await demoFetch("/apiary");
    expect(handle).not.toHaveBeenCalled();
    expect(realFetch).toHaveBeenCalledTimes(3);
  });

  it("recognizes only same-origin /api/ and /uploads/ paths", () => {
    const here = window.location.origin;
    expect(isFakeApiRequest(new URL(`${here}/api/me`))).toBe(true);
    expect(isFakeApiRequest(new URL(`${here}/uploads/a.png`))).toBe(true);
    expect(isFakeApiRequest(new URL(`${here}/FamilyPassportMap/us/map`))).toBe(false);
    expect(isFakeApiRequest(new URL("https://elsewhere.test/api/me"))).toBe(false);
  });
});

describe("demo photo URLs", () => {
  it("gives an in-memory photo one blob: URL, and anything else the server path", () => {
    const store = createStore(DEMO_SEED);
    const createObjectURL = vi.fn(() => "blob:demo/1");
    // jsdom has no URL.createObjectURL; put a stand-in on for this test only.
    const original = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;
    try {
      setPhotoUrlResolver(demoPhotoUrls(store));
      expect(photoUrl("uploads/demo-seed-marge.svg")).toBe("blob:demo/1");
      expect(photoUrl("uploads/demo-seed-marge.svg")).toBe("blob:demo/1");
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(photoUrl("uploads/gone.png")).toBe("/uploads/gone.png");
    } finally {
      URL.createObjectURL = original;
    }
  });

  it("uses the server's /uploads URL in the normal app", () => {
    expect(photoUrl("uploads/abc.jpg")).toBe("/uploads/abc.jpg");
  });
});
