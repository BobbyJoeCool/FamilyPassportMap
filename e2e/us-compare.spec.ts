import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./helpers";

// Read-only: uses alice's seeded data (Alice: CA, NY; Sam: CA).
test.use({ storageState: AUTH_STATE.alice });

test("compares two People side by side", async ({ page }) => {
  await page.goto("/us/compare");
  await expect(page.getByText("Select people above to compare their maps.")).toBeVisible();

  await page.getByRole("checkbox", { name: "Alice" }).check();
  await page.getByRole("checkbox", { name: "Sam" }).check();
  await expect(page.locator("main svg")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /Alice/ })).toContainText("2/50 states");
  await expect(page.getByRole("heading", { name: /Sam/ })).toContainText("1/50 states");

  // California is shared, so it's filled on both maps; New York is only Alice's.
  const california = page.locator('[data-state-code="CA"]');
  await expect(california.nth(0)).toHaveCSS("fill", "rgb(51, 102, 204)");
  await expect(california.nth(1)).toHaveCSS("fill", "rgb(0, 170, 0)");
  const newYork = page.locator('[data-state-code="NY"]');
  await expect(newYork.nth(0)).toHaveCSS("fill", "rgb(51, 102, 204)");
  await expect(newYork.nth(1)).toHaveCSS("fill", "rgb(229, 229, 229)");
});

test("unchecking a Person removes their map", async ({ page }) => {
  await page.goto("/us/compare");
  await page.getByRole("checkbox", { name: "Alice" }).check();
  await expect(page.locator("main svg")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Alice" }).uncheck();
  await expect(page.locator("main svg")).toHaveCount(0);
});
