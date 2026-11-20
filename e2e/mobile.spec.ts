import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

// The main screens at a phone viewport (the "mobile" project: Pixel 7, touch).

test("the bottom tab bar reaches every screen", async ({ page }) => {
  await newUser(page, "mobile");
  const tabBar = page.locator("nav.fixed");
  await expect(tabBar).toBeVisible();
  // The desktop top nav is hidden at this width.
  await expect(page.locator("nav").first()).toBeHidden();

  await tabBar.getByRole("link", { name: /World/ }).tap();
  await expect(page).toHaveURL(/\/world\/map$/);
  await expect(page.getByRole("heading", { name: "World Map" })).toBeVisible();

  await tabBar.getByRole("link", { name: /People/ }).tap();
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

  await tabBar.getByRole("link", { name: /US/ }).tap();
  await expect(page).toHaveURL(/\/us\/map$/);
});

test("the map fits the screen and a tap marks a state", async ({ page }) => {
  await newUser(page, "mobile");
  const map = page.locator("main svg");
  const box = await map.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.width).toBeLessThanOrEqual(viewport.width);

  await page.locator('[data-state-code="CO"]').tap();
  await expect(page.getByText("1/50 states")).toBeVisible();
});

test("the account menu is in the top bar", async ({ page }) => {
  await newUser(page, "mobile");
  // On a phone the button shows only the first letter of the name ("Mobile-…" → "M").
  await page.locator("header").getByRole("button", { name: "M", exact: true }).tap();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
});
