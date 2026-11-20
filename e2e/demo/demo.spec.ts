import { expect, test, type Page } from "@playwright/test";
import { TINY_PNG } from "../helpers";

// The guest demo, built with `npm run build:demo` and served like GitHub Pages under
// /FamilyPassportMap/ (e2e/demo-pages-server.mjs). Paths here have no leading slash so they resolve
// under that base (the demo project's baseURL). Every test gets a fresh page, so a fresh demo.

/**
 * The People list row for one name.
 * @param page - the browser page.
 * @param name - the Person's exact name.
 * @returns the row locator.
 */
function row(page: Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
}

/**
 * Adds a Person from the People page form.
 * @param page - the browser page (already on People).
 * @param name - the new Person's name.
 */
async function addPerson(page: Page, name: string) {
  await page.getByPlaceholder("e.g. Alice").fill(name);
  await page.getByLabel("Color").fill("#123456");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(row(page, name)).toBeVisible();
}

test("opens on the US map with the sample family and the banner, without signing in", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveURL(/\/FamilyPassportMap\/us\/map$/);
  await expect(page.getByRole("note", { name: "Demo notice" })).toContainText(
    "Demo: changes aren't saved, and reloading starts over.",
  );
  await expect(page.getByLabel("Person")).toHaveValue(/.+/);
  await expect(page.getByLabel("Person").locator("option")).toHaveText(["Homer", "Marge", "Bart", "Lisa"]);
  await expect(page.getByText("20/50 states")).toBeVisible();
});

test("a Person and a visit added in the demo are gone after a reload", async ({ page }) => {
  await page.goto("people");
  await addPerson(page, "Maggie");

  await page.goto("us/map");
  const wyoming = page.locator('[data-state-code="WY"]');
  await expect(page.getByText("20/50 states")).toBeVisible();
  await wyoming.click();
  await expect(page.getByText("21/50 states")).toBeVisible();

  await page.reload();
  await expect(page.getByText("20/50 states")).toBeVisible();
  await page.goto("people");
  await expect(row(page, "Homer")).toBeVisible();
  await expect(row(page, "Maggie")).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(4);
});

test("stops at 10 People, like the real app, and You has no Delete", async ({ page }) => {
  await page.goto("people");
  await expect(page.getByRole("listitem")).toHaveCount(4);
  // Six more fill the family to the cap of 10.
  for (const name of ["P5", "P6", "P7", "P8", "P9", "P10"]) await addPerson(page, name);
  await expect(page.getByText("You can have up to 10 people, including yourself.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add person" })).toBeDisabled();
  await expect(row(page, "Homer").getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("Set as me merges Homer's visits into Bart and removes Homer", async ({ page }) => {
  await page.goto("people");
  await row(page, "Bart").getByRole("button", { name: "Set as me" }).click();
  // Confirm in Bart's row, which now asks "Set Bart as you?".
  await page.getByRole("listitem").filter({ hasText: "as you?" }).getByRole("button", { name: "Set as me" }).click();
  await expect(row(page, "Homer")).toHaveCount(0);
  await expect(row(page, "Bart")).toContainText("You");
  // Bart's 8 states plus Homer's 20, minus the 6 they share (CA, CO, FL, IL, NY, TX): 22.
  await expect(row(page, "Bart")).toContainText("22/50 states");
});

test("uploads a photo, shrunk to 256×256 in the browser", async ({ page }) => {
  await page.goto("people");
  await row(page, "Homer").getByRole("button", { name: "Edit" }).click();
  await page.locator('li input[type="file"]').setInputFiles(TINY_PNG);
  const photo = page.getByRole("img", { name: "Homer" });
  await expect(photo).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(256);
});

test("shows the seed avatars", async ({ page }) => {
  await page.goto("people");
  const marge = page.getByRole("img", { name: "Marge" });
  await expect(marge).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => marge.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("the account menu has only Guest and Privacy, and Privacy says nothing leaves the browser", async ({ page }) => {
  await page.goto("us/map");
  await page.getByRole("button", { name: /Guest/ }).first().click();
  await expect(page.getByRole("menuitem")).toHaveText(["Privacy"]);
  await page.getByRole("menuitem", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/FamilyPassportMap\/privacy$/);
  await expect(page.getByText(/Nothing you type or upload leaves it/)).toBeVisible();
});

test.describe("sign-in pages", () => {
  for (const path of ["signin", "welcome"]) {
    test(`/${path} goes straight to the US map`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/FamilyPassportMap\/us\/map$/);
      await expect(page.getByRole("link", { name: /Sign in with/ })).toHaveCount(0);
    });
  }
});

test("a deep link loads the app through GitHub Pages' 404.html", async ({ page }) => {
  const res = await page.goto("world/compare");
  // Pages answers an unknown path with 404.html and a 404 status; the app still loads.
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("note", { name: "Demo notice" })).toBeVisible();
  await expect(page).toHaveURL(/\/FamilyPassportMap\/world\/compare$/);
  await expect(page.getByText("Homer").first()).toBeVisible();
});

test("registers no service worker and links no manifest", async ({ page }) => {
  await page.goto("us/map");
  await expect(page.getByText("20/50 states")).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((list) => list.length))).toBe(0);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
});

test("sends no API request over the network", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    // Anything under /api or /uploads that reaches the network means the fake API was bypassed.
    if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) apiRequests.push(request.url());
  });
  await page.goto("people");
  await expect(row(page, "Lisa")).toBeVisible();
  await page.goto("us/compare");
  await page.goto("world/list");
  // Every country row is there, and Homer's avatar marks the ones he's visited.
  await expect(page.locator("main section .grid > div")).toHaveCount(195);
  await expect(page.getByLabel("Homer").first()).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test("shows the banner and the bottom tabs", async ({ page }) => {
    await page.goto("us/map");
    await expect(page.getByRole("note", { name: "Demo notice" })).toBeVisible();
    await page.getByRole("link", { name: /People/ }).last().tap();
    await expect(page).toHaveURL(/\/FamilyPassportMap\/people$/);
    await expect(row(page, "Lisa")).toBeVisible();
  });
});
