import { expect, test, type Page } from "@playwright/test";
import { TINY_PNG, newUser } from "./helpers";

// The People page: add, rename, photo, delete, and the empty-name error. Each test uses its own
// brand-new User, so nothing here touches another test's data.

/**
 * The People list row for one name.
 * @param page - the browser page.
 * @param name - the Person's exact name.
 * @returns the row locator.
 */
function row(page: Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
}

test.beforeEach(async ({ page }) => {
  await newUser(page, "people");
  await page.goto("/people");
  await expect(row(page, "Me")).toBeVisible();
});

test("adds a Person, who appears with empty counters", async ({ page }) => {
  await page.getByPlaceholder("e.g. Alice").fill("Zed");
  await page.getByLabel("Color").fill("#ff0000");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(row(page, "Zed")).toContainText("0/50 states");
  await expect(row(page, "Zed")).toContainText("0/195 countries");
});

test("an empty name is refused", async ({ page }) => {
  await page.getByLabel("Color").fill("#ff0000");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText("Name is required.")).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);
});

test("renames a Person", async ({ page }) => {
  await page.getByPlaceholder("e.g. Alice").fill("Zed");
  await page.getByLabel("Color").fill("#ff0000");
  await page.getByRole("button", { name: "Add person" }).click();

  await row(page, "Zed").getByRole("button", { name: "Edit" }).click();
  await page.locator('li input:not([type="color"]):not([type="file"])').fill("Zedd");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(row(page, "Zedd")).toBeVisible();
  await page.reload();
  await expect(row(page, "Zedd")).toBeVisible();
});

test("uploads a photo, which replaces the initials", async ({ page }) => {
  await row(page, "Me").getByRole("button", { name: "Edit" }).click();
  await page.locator('li input[type="file"]').setInputFiles(TINY_PNG);
  // The row stays in edit mode (no name text to find it by), so find the avatar by its alt text.
  const photo = page.getByRole("img", { name: "Me" });
  await expect(photo).toHaveAttribute("src", /^\/uploads\/.+\.png$/);
  // The private photo actually loads for its Owner.
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
});

test("deletes a Person after confirming", async ({ page }) => {
  await page.getByPlaceholder("e.g. Alice").fill("Zed");
  await page.getByLabel("Color").fill("#ff0000");
  await page.getByRole("button", { name: "Add person" }).click();

  await row(page, "Zed").getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(row(page, "Zed")).toHaveCount(0);
  await page.reload();
  await expect(row(page, "Me")).toBeVisible();
  await expect(row(page, "Zed")).toHaveCount(0);
});
