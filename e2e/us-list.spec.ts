import { expect, test, type Page } from "@playwright/test";
import { AUTH_STATE } from "./helpers";

// Read-only: uses alice's seeded data (Alice: CA, NY; Sam: CA).
test.use({ storageState: AUTH_STATE.alice });

/**
 * The List row for one state or country.
 * @param page - the browser page.
 * @param name - the place's name.
 * @returns the row locator.
 */
function placeRow(page: Page, name: string) {
  return page.locator("main .grid > div").filter({ has: page.getByText(name, { exact: true }) });
}

test("lists all 50 states alphabetically", async ({ page }) => {
  await page.goto("/us/list");
  const rows = page.locator("main .grid > div");
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText("Alabama");
  await expect(rows.last()).toContainText("Wyoming");
});

test("shows who has visited each state, and nobody for unvisited ones", async ({ page }) => {
  await page.goto("/us/list");
  await expect(placeRow(page, "California").getByLabel(/Alice|Sam/)).toHaveCount(2);
  await expect(placeRow(page, "New York").getByLabel("Alice")).toBeVisible();
  await expect(placeRow(page, "Texas").getByLabel(/Alice|Sam/)).toHaveCount(0);
});
