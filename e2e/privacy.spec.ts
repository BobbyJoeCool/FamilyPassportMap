import { expect, test } from "@playwright/test";
import { AUTH_STATE, api } from "./helpers";

// Private data: two signed-in Users in two separate browser contexts.

test("one User can't see another's People or photos", async ({ browser }) => {
  const bobContext = await browser.newContext({ storageState: AUTH_STATE.bob });
  const aliceContext = await browser.newContext({ storageState: AUTH_STATE.alice });
  const anonymousContext = await browser.newContext();

  try {
    const bobPeople = await api(bobContext.request, "GET", "/api/people");
    const photoPath: string = bobPeople[0].profilePicturePath;
    expect(photoPath).toMatch(/^uploads\//);

    // Bob sees his own photo, in the browser too.
    const bobPage = await bobContext.newPage();
    await bobPage.goto("/people");
    await expect(bobPage.getByRole("img", { name: "Bob" })).toHaveAttribute("src", `/${photoPath}`);
    expect((await bobContext.request.get(`/${photoPath}`)).status()).toBe(200);

    // Alice and a signed-out visitor get a bare 404 for the same URL.
    expect((await aliceContext.request.get(`/${photoPath}`)).status()).toBe(404);
    expect((await anonymousContext.request.get(`/${photoPath}`)).status()).toBe(404);

    // Bob isn't anywhere on Alice's People page.
    const alicePage = await aliceContext.newPage();
    await alicePage.goto("/people");
    await expect(alicePage.getByText("Sam", { exact: true })).toBeVisible();
    await expect(alicePage.getByText("Bob", { exact: true })).toHaveCount(0);
  } finally {
    await Promise.all([bobContext.close(), aliceContext.close(), anonymousContext.close()]);
  }
});
