import { expect, test, type Page } from "@playwright/test";
import { AUTH_STATE } from "./helpers";

// Read-only: uses alice's seeded data (Alice: France; Sam: Japan).
test.use({ storageState: AUTH_STATE.alice });

/**
 * The World List row for one country.
 * @param page - the browser page.
 * @param name - the country's name.
 * @returns the row locator.
 */
function countryRow(page: Page, name: string) {
  return page.locator("main section .grid > div").filter({ has: page.getByText(name, { exact: true }) });
}

test("groups all 195 countries into the six continents", async ({ page }) => {
  await page.goto("/world/list");
  await expect(page.locator("main section h2")).toHaveText([
    /^Africa/,
    /^Asia/,
    /^Europe/,
    /^North America/,
    /^Oceania/,
    /^South America/,
  ]);
  await expect(page.locator("main section .grid > div")).toHaveCount(195);
});

test("shows who has visited each country", async ({ page }) => {
  await page.goto("/world/list");
  await expect(countryRow(page, "France").getByLabel("Alice")).toBeVisible();
  await expect(countryRow(page, "Japan").getByLabel("Sam")).toBeVisible();
  await expect(countryRow(page, "Brazil").getByLabel(/Alice|Sam/)).toHaveCount(0);
});
