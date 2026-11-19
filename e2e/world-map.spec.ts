import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

// Marking countries on the world map, including the continent selector. Germany is used because
// it's compact: a click at the center of its box lands on it.

test("the World overview is view-only; a continent view marks countries", async ({ page }) => {
  await newUser(page, "worldmap");
  await page.goto("/world/map");
  const germany = page.locator('path[data-country-code="DE"]');
  await expect(page.getByText("0/195 countries")).toBeVisible();
  await expect(page.getByText("Pick a continent to mark countries.")).toBeVisible();

  // Clicking in the overview changes nothing.
  await germany.click();
  await expect(page.getByText("0/195 countries")).toBeVisible();

  await page.getByRole("button", { name: "Europe" }).click();
  await expect(page.getByRole("button", { name: "Europe" })).toHaveAttribute("aria-pressed", "true");
  await germany.click();
  await expect(page.getByText("1/195 countries")).toBeVisible();
  await expect(germany).toHaveCSS("fill", "rgb(51, 102, 204)");

  // The visit survives a reload (the view goes back to World, the count doesn't change).
  await page.reload();
  await expect(page.getByText("1/195 countries")).toBeVisible();

  await page.getByRole("button", { name: "Europe" }).click();
  await germany.click();
  await expect(page.getByText("0/195 countries")).toBeVisible();
});

test("micro-states get a clickable dot in their continent view", async ({ page }) => {
  await newUser(page, "worldmap");
  await page.goto("/world/map");
  await page.getByRole("button", { name: "Europe" }).click();
  await page.locator('circle[data-country-code="VA"]').click();
  await expect(page.getByText("1/195 countries")).toBeVisible();
});
