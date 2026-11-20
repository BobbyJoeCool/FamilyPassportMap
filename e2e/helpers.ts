import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Where the setup project saves each seeded User's signed-in browser state. */
export const AUTH_STATE = {
  alice: "e2e/.auth/alice.json",
  bob: "e2e/.auth/bob.json",
} as const;

/** A small, valid PNG (8×8, one color), for photo uploads. */
export const TINY_PNG = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4Y5yGFTEMLQkA+UZZQb2tApIAAAAASUVORK5CYII=",
    "base64",
  ),
};

/**
 * A fake-sign-in user name no other test uses, so tests that change data never share a User.
 * @param prefix - a short readable prefix (lowercase letters and dashes).
 * @returns a valid fake user name, e.g. "people-lz3k9a-x7f2".
 */
export function uniqueUserName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Goes through a provider's fake sign-in page (E2E stand-in for Microsoft, Google or GitHub) after
 * clicking its button.
 * @param page - the browser page, already on the fake page.
 * @param userName - the fake user name.
 */
export async function completeFakeProvider(page: Page, userName: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Fake sign-in (E2E tests only)" })).toBeVisible();
  await page.getByLabel("User name").fill(userName);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * The newest Email code "sent" to an address (E2E runs keep mail in an in-memory outbox).
 * @param request - a request client for the app.
 * @param to - the address.
 * @returns the 6-digit code.
 */
export async function emailCodeFor(request: APIRequestContext, to: string): Promise<string> {
  let code = "";
  // The code is sent in the background, so give it a moment to land.
  await expect
    .poll(async () => {
      const res = await request.get(`/api/auth/e2e/outbox?to=${encodeURIComponent(to)}`);
      // No message yet.
      if (!res.ok()) return "";
      code = /\b(\d{6})\b/.exec((await res.json()).text)?.[1] ?? "";
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code;
}

/**
 * Signs in through the real sign-in page and the E2E fake Microsoft page.
 * @param page - the browser page.
 * @param userName - the fake user name to sign in as.
 * @param returnTo - an optional page to come back to (the sign-in page's `returnTo`).
 */
export async function signInAs(page: Page, userName: string, returnTo?: string): Promise<void> {
  // Start on /signin directly unless the test already navigated there.
  if (!page.url().includes("/signin")) {
    await page.goto(returnTo ? `/signin?returnTo=${encodeURIComponent(returnTo)}` : "/signin");
  }
  await page.getByRole("link", { name: "Continue with Microsoft" }).click();
  await expect(page.getByRole("heading", { name: "Fake sign-in (E2E tests only)" })).toBeVisible();
  await page.getByLabel("User name").fill(userName);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Signs a brand-new User in and finishes the welcome step through the API, leaving the page on
 * the US map.
 * @param page - the browser page (its cookies become this User's).
 * @param prefix - the user-name prefix (see `uniqueUserName`).
 * @returns the User's fake user name, the display name the account menu shows, and their
 *   Primary Person's id.
 */
export async function newUser(
  page: Page,
  prefix: string,
): Promise<{ userName: string; displayName: string; primaryId: string }> {
  const userName = uniqueUserName(prefix);
  await signInAs(page, userName);
  await expect(page).toHaveURL(/\/welcome$/);
  const primary = await api(page.request, "POST", "/api/me/primary-person", { name: "Me", colorHex: "#3366cc" });
  await page.goto("/us/map");
  // The fake identity's display name is the user name with a capital first letter.
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);
  return { userName, displayName, primaryId: primary.id };
}

/**
 * Calls the API with the page's cookies, failing the test on any error status.
 * @param request - the page's (or context's) request client.
 * @param method - the HTTP method.
 * @param path - the API path.
 * @param data - an optional JSON body.
 * @returns the parsed JSON body, or null for an empty one.
 */
export async function api(
  request: APIRequestContext,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
) {
  const res = await request.fetch(path, { method, data });
  expect(res.ok(), `${method} ${path} → ${res.status()} ${await res.text()}`).toBe(true);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
