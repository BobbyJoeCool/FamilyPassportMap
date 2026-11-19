import { expect, test } from "@playwright/test";
import { signInAs, uniqueUserName } from "./helpers";

// Signing in, the welcome step, signing out, and the sign-in gate.

test("a signed-out visitor lands on the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("link", { name: "Sign in with Microsoft" })).toBeVisible();
});

test("a new User signs in, finishes the welcome step and lands on the US map", async ({ page }) => {
  await signInAs(page, uniqueUserName("newbie"));
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible();

  // Continue without choosing a color is refused.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please choose a color.")).toBeVisible();

  await page.getByLabel("Your name").fill("New Person");
  await page.getByLabel("Your color").fill("#ff8800");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/us\/map$/);
  await expect(page.getByRole("heading", { name: "US Map" })).toBeVisible();
  await expect(page.getByLabel("Person")).toHaveValue(/.+/);
});

test("a returning User goes straight to the US map", async ({ page }) => {
  await signInAs(page, "alice");
  await expect(page).toHaveURL(/\/us\/map$/);
  await expect(page.getByRole("heading", { name: "US Map" })).toBeVisible();
});

test("a protected page sends you to sign in, then back to that page", async ({ page }) => {
  await page.goto("/world/list");
  await expect(page).toHaveURL(/\/signin\?returnTo=%2Fworld%2Flist/);
  await signInAs(page, "alice");
  await expect(page).toHaveURL(/\/world\/list$/);
  await expect(page.getByRole("heading", { name: "World List" })).toBeVisible();
});

test("signing out returns to the sign-in page and ends the session", async ({ page }) => {
  await signInAs(page, "alice");
  await expect(page).toHaveURL(/\/us\/map$/);
  await page.getByRole("button", { name: /Alice/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);

  await page.goto("/people");
  await expect(page).toHaveURL(/\/signin\?returnTo=%2Fpeople/);
});

test("a failed sign-in explains itself on the sign-in page", async ({ page }) => {
  // The fake provider rejects names that aren't lowercase, like Microsoft rejecting a code.
  await signInAs(page, "Not Valid");
  await expect(page).toHaveURL(/\/signin\?error=failed/);
  await expect(page.getByRole("alert")).toHaveText("Sign-in didn't work. Please try again.");
});

test("the privacy page is public", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page).toHaveURL(/\/privacy$/);
});
