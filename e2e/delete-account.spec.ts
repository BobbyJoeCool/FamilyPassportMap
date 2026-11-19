import { expect, test } from "@playwright/test";
import { api, newUser, signInAs } from "./helpers";

// Deleting an account removes everything and signs the User out.

test("Cancel keeps the account", async ({ page }) => {
  const { displayName } = await newUser(page, "keep");
  await page.getByRole("button", { name: new RegExp(displayName) }).click();
  await page.getByRole("menuitem", { name: "Delete account" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await page.request.get("/api/me")).status()).toBe(200);
});

test("deleting the account removes its data and signs out", async ({ page }) => {
  const { userName, displayName } = await newUser(page, "goner");
  await api(page.request, "POST", "/api/people", { name: "Extra", colorHex: "#00aa00" });

  await page.getByRole("button", { name: new RegExp(displayName) }).click();
  await page.getByRole("menuitem", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(dialog).toContainText("all your People");
  await dialog.getByRole("button", { name: "Delete my account" }).click();

  await expect(page).toHaveURL(/\/signin$/);
  expect((await page.request.get("/api/me")).status()).toBe(401);

  // Signing in with the same identity starts over: a new account at the welcome step, no People.
  await signInAs(page, userName);
  await expect(page).toHaveURL(/\/welcome$/);
  expect(await api(page.request, "GET", "/api/people")).toEqual([]);
});
