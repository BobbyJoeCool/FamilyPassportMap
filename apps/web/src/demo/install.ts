import { setPhotoUrlResolver } from "../api/photos";
import { createFakeApi, type FakeApi } from "./fakeApi";
import { shrinkPhotoInBrowser } from "./photo";
import { DEMO_SEED } from "./seed";
import { createStore, type DemoStore } from "./store";

// The guest demo's one seam into the app. main.tsx imports this only in a demo build
// (VITE_DEMO=true), so the normal build never contains any of src/demo.

/** How long each fake answer waits, so loading states show as they would on the real app. */
const DEMO_DELAY_MS = 150;

/**
 * Whether a request is one the fake API answers: same origin, under /api/ or /uploads/.
 * @param url - the resolved request URL.
 * @returns true for API and photo requests.
 */
export function isFakeApiRequest(url: URL): boolean {
  return url.origin === window.location.origin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/"));
}

/**
 * Builds a `fetch` that sends API and photo requests to the fake API and everything else to the
 * real `fetch`.
 * @param api - the fake API.
 * @param realFetch - the browser's own fetch.
 * @returns the replacement fetch.
 */
export function createDemoFetch(api: FakeApi, realFetch: typeof fetch): typeof fetch {
  return (input, init) => {
    // The app always passes a string path, but a URL or Request is handled too.
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (!isFakeApiRequest(url)) return realFetch(input, init);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    return api.handle(method, url, init);
  };
}

/**
 * A photo resolver that serves the demo's in-memory photos as `blob:` URLs, one per photo, made
 * the first time it's shown. Paths it doesn't hold fall back to `/uploads/<file>`.
 * @param store - the demo store holding the photos.
 * @returns the resolver.
 */
export function demoPhotoUrls(store: DemoStore): (profilePicturePath: string) => string {
  const urls = new WeakMap<Blob, string>();
  return (profilePicturePath) => {
    const blob = store.photos.get(profilePicturePath.replace(/^uploads\//, ""));
    // Not in memory (e.g. removed): the same URL the normal app would use, which won't load.
    if (!blob) return `/${profilePicturePath}`;
    let url = urls.get(blob);
    // First time this photo is shown: give it an object URL and remember it.
    if (!url) {
      url = URL.createObjectURL(blob);
      urls.set(blob, url);
    }
    return url;
  };
}

/**
 * Starts the guest demo: a fresh store from the seed, the fake API in front of `fetch`, and
 * in-memory photo URLs. Called once, before the app renders.
 */
export function installDemo(): void {
  const store = createStore(DEMO_SEED);
  const api = createFakeApi(store, { delayMs: DEMO_DELAY_MS, shrinkPhoto: shrinkPhotoInBrowser });
  window.fetch = createDemoFetch(api, window.fetch.bind(window));
  setPhotoUrlResolver(demoPhotoUrls(store));
}
