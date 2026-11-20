import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./helpers";

// Read-only: uses alice's seeded data (Alice: France; Sam: Japan).
test.use({ storageState: AUTH_STATE.alice });

test("compares two People's countries on one shared continent view", async ({ page }) => {
  await page.goto("/world/compare");
  await expect(page.getByText("Select people above to compare their maps.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Choose a continent" })).toHaveCount(0);

  await page.getByRole("checkbox", { name: "Alice" }).check();
  await page.getByRole("checkbox", { name: "Sam" }).check();
  await expect(page.locator("main svg")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /Alice/ })).toContainText("1/195 countries");
  await expect(page.getByRole("heading", { name: /Sam/ })).toContainText("1/195 countries");

  // One selector frames both maps: in Asia, Japan is filled on Sam's map only.
  await page.getByRole("button", { name: "Asia" }).click();
  const japan = page.locator('path[data-country-code="JP"]');
  await expect(japan.nth(0)).toHaveCSS("fill", "rgb(229, 229, 229)");
  await expect(japan.nth(1)).toHaveCSS("fill", "rgb(0, 170, 0)");
});
