import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

// Marking states on the US map. Colorado is used because it's a rectangle: a click at the center
// of its box always lands on it.

test("marks and unmarks a state, and the visit survives a reload", async ({ page }) => {
  await newUser(page, "usmap");
  const colorado = page.locator('[data-state-code="CO"]');
  await expect(page.getByText("0/50 states")).toBeVisible();

  await colorado.click();
  await expect(page.getByText("1/50 states")).toBeVisible();
  await expect(colorado).toHaveCSS("fill", "rgb(51, 102, 204)");

  await page.reload();
  await expect(page.getByText("1/50 states")).toBeVisible();
  await expect(colorado).toHaveCSS("fill", "rgb(51, 102, 204)");

  await colorado.click();
  await expect(page.getByText("0/50 states")).toBeVisible();
  await page.reload();
  await expect(page.getByText("0/50 states")).toBeVisible();
  await expect(colorado).toHaveCSS("fill", "rgb(229, 229, 229)");
});

test("hovering a state shows its full name", async ({ page }) => {
  await newUser(page, "usmap");
  await page.locator('[data-state-code="CO"]').hover();
  await expect(page.getByText("Colorado", { exact: true })).toBeVisible();
});
