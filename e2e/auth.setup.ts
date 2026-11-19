import { expect, test as setup } from "@playwright/test";
import { AUTH_STATE, TINY_PNG, api, signInAs } from "./helpers";

// Seeds the two Users that read-only specs share, through the real sign-in flow and API, and
// saves each one's signed-in browser state. The database is new every run (e2e/start-server.mjs).
//
// alice: Alice (You; CA, NY, France) and Sam (CA, Japan).
// bob:   Bob (You, with a photo).

setup("seed and sign in alice", async ({ page }) => {
  await signInAs(page, "alice");
  await expect(page).toHaveURL(/\/welcome$/);
  const alice = await api(page.request, "POST", "/api/me/primary-person", { name: "Alice", colorHex: "#3366cc" });
  const sam = await api(page.request, "POST", "/api/people", { name: "Sam", colorHex: "#00aa00" });
  // Mark each seeded visit through the same endpoints the maps use.
  for (const [personId, code] of [
    [alice.id, "CA"],
    [alice.id, "NY"],
    [sam.id, "CA"],
  ]) {
    await api(page.request, "PUT", `/api/people/${personId}/visits/${code}`);
  }
  await api(page.request, "PUT", `/api/people/${alice.id}/countries/FR`);
  await api(page.request, "PUT", `/api/people/${sam.id}/countries/JP`);
  await page.context().storageState({ path: AUTH_STATE.alice });
});

setup("seed and sign in bob", async ({ page }) => {
  await signInAs(page, "bob");
  await expect(page).toHaveURL(/\/welcome$/);
  const bob = await api(page.request, "POST", "/api/me/primary-person", { name: "Bob", colorHex: "#aa5500" });
  const upload = await page.request.post(`/api/people/${bob.id}/photo`, { multipart: { photo: TINY_PNG } });
  expect(upload.ok()).toBe(true);
  await page.context().storageState({ path: AUTH_STATE.bob });
});
