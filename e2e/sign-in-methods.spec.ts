import { expect, test, type Page } from "@playwright/test";
import { api, completeFakeProvider, newUser, uniqueUserName } from "./helpers";

// Phase 13's sign-in methods in a real browser. Providers go through the E2E fake sign-in page, and
// passkeys use Chrome's virtual authenticator
// (a software passkey device driven through the DevTools protocol). Every test uses brand-new Users.

/**
 * Gives the page a virtual passkey device that says yes to every prompt.
 * @param page - the browser page.
 */
async function addVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

/**
 * Finishes the welcome step through the API, then opens the US map.
 * @param page - the browser page (on /welcome).
 * @param name - the Primary Person's name.
 */
async function finishWelcome(page: Page, name: string): Promise<void> {
  await expect(page).toHaveURL(/\/welcome$/);
  await api(page.request, "POST", "/api/me/primary-person", { name, colorHex: "#3366cc" });
  await page.goto("/us/map");
}

/**
 * Signs out through the API (the cookie is cleared for the whole browser context).
 * @param page - the browser page.
 */
async function signOut(page: Page): Promise<void> {
  await api(page.request, "POST", "/api/auth/signout");
}

/**
 * The signed-in User's id.
 * @param page - the browser page.
 * @returns the id from /api/me.
 */
async function currentUserId(page: Page): Promise<string> {
  return (await api(page.request, "GET", "/api/me")).user.id;
}

test("the sign-in page offers every method set up on the server", async ({ page }) => {
  await page.goto("/signin");
  for (const provider of ["Microsoft", "Google", "GitHub"]) {
    await expect(page.getByRole("link", { name: `Continue with ${provider}` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
  // Email codes were removed before v2.5.0 shipped.
  await expect(page.getByLabel("Email")).toHaveCount(0);
});

for (const provider of ["Google", "GitHub"]) {
  test(`signing up with ${provider} lands on the welcome step, and signing in again returns to the account`, async ({ page }) => {
    const name = uniqueUserName(provider.toLowerCase());
    await page.goto("/signin");
    await page.getByRole("link", { name: `Continue with ${provider}` }).click();
    await completeFakeProvider(page, name);
    await finishWelcome(page, "Me");
    const id = await currentUserId(page);

    await signOut(page);
    await page.goto("/signin");
    await page.getByRole("link", { name: `Continue with ${provider}` }).click();
    await completeFakeProvider(page, name);
    await expect(page).toHaveURL(/\/us\/map$/);
    expect(await currentUserId(page)).toBe(id);
  });
}

test("creating an account with a passkey, then signing back in with it", async ({ page }) => {
  await addVirtualAuthenticator(page);
  await page.goto("/signin");
  await page.getByRole("button", { name: "New here? Create an account with a passkey" }).click();
  await finishWelcome(page, "Keyholder");
  const id = await currentUserId(page);

  await signOut(page);
  await page.goto("/signin");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page).toHaveURL(/\/us\/map$/);
  expect(await currentUserId(page)).toBe(id);
});

test("adding Google and a passkey to a Microsoft account; each then signs into it", async ({ page }) => {
  await addVirtualAuthenticator(page);
  await newUser(page, "adder");
  const id = await currentUserId(page);
  const googleName = uniqueUserName("added-google");

  await page.getByRole("button", { name: /Adder/ }).first().click();
  await page.getByRole("menuitem", { name: "Sign-in methods" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in$/);

  // Google, through its fake page and back.
  await page.getByRole("link", { name: "Add Google" }).click();
  await completeFakeProvider(page, googleName);
  await expect(page).toHaveURL(/\/account\/sign-in$/);
  await expect(page.getByRole("listitem").filter({ hasText: "Google:" })).toBeVisible();

  // A passkey on this (virtual) device.
  await page.getByPlaceholder("e.g. Bob's iPhone").fill("E2E key");
  await page.getByRole("button", { name: "Add passkey" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Passkey: E2E key" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(3);

  // Each new method signs into the same account.
  await signOut(page);
  await page.goto("/signin");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await completeFakeProvider(page, googleName);
  expect(await currentUserId(page)).toBe(id);

  await signOut(page);
  await page.goto("/signin");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page).toHaveURL(/\/us\/map$/);
  expect(await currentUserId(page)).toBe(id);
});

test("removing methods down to the last one, which can't be removed", async ({ page }) => {
  await newUser(page, "remover");
  await page.goto("/account/sign-in");
  await page.getByRole("link", { name: "Add GitHub" }).click();
  await completeFakeProvider(page, uniqueUserName("rm-github"));
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("listitem").filter({ hasText: "Microsoft:" }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").getByRole("button", { name: "Remove" })).toBeDisabled();
  await expect(page.getByText("This is your only way to sign in, so it can't be removed. Add another first.")).toBeVisible();
});

test("adding a Google account that belongs to someone else says so, and changes nothing", async ({ page, browser }) => {
  const googleName = uniqueUserName("owned");
  // Someone else signs up with that Google account first, in their own browser.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto("/signin");
  await other.getByRole("link", { name: "Continue with Google" }).click();
  await completeFakeProvider(other, googleName);
  await expect(other).toHaveURL(/\/welcome$/);
  await otherContext.close();

  await newUser(page, "taker");
  await page.goto("/account/sign-in");
  await page.getByRole("link", { name: "Add Google" }).click();
  await completeFakeProvider(page, googleName);
  await expect(page).toHaveURL(/\/account\/sign-in\?error=taken$/);
  await expect(page.getByRole("alert")).toHaveText("That sign-in already belongs to another account.");
  await expect(page.getByRole("listitem")).toHaveCount(1);
});
