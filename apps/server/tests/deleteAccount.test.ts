import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { UPLOADS_DIR } from "../src/env.js";
import { completeSignIn, fakeCode, identityFor, newAgent, signIn, type TestAgent } from "./helpers.js";

let alice: TestAgent;
let aliceCookie: string;

/**
 * Builds a small PNG to upload as a profile photo.
 * @returns the encoded image bytes.
 */
function pngImage(): Promise<Buffer> {
  return sharp({ create: { width: 50, height: 50, channels: 3, background: "#3366cc" } })
    .png()
    .toBuffer();
}

// Alice is signed in (keeping a copy of her session cookie) and has finished the welcome step.
beforeEach(async () => {
  alice = newAgent();
  const signedIn = await completeSignIn(alice, fakeCode(identityFor("alice")));
  aliceCookie = (signedIn.headers["set-cookie"] as unknown as string[])
    .find((cookie) => cookie.startsWith("fpm_session="))!
    .split(";")[0];
  await alice.post("/api/me/primary-person").send({ name: "Alice", colorHex: "#aa00aa" });
});

describe("Delete account", () => {
  it("returns 204, clears the cookie, and the old session cookie is refused afterwards", async () => {
    const res = await alice.delete("/api/me");
    expect(res.status).toBe(204);
    const cleared = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("fpm_session="));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);

    // A copied cookie must be refused by the server itself, not just dropped by the browser.
    expect((await request(app).get("/api/me").set("Cookie", aliceCookie)).status).toBe(401);
  });

  it("removes the User's People, visits, countries, sessions and photo files, and nobody else's", async () => {
    const kid = (await alice.post("/api/people").send({ name: "Kid", colorHex: "#ff0000" })).body.id;
    await alice.put(`/api/people/${kid}/visits/CA`);
    await alice.put(`/api/people/${kid}/countries/FR`);
    const alicePhoto = (await alice.post(`/api/people/${kid}/photo`).attach("photo", await pngImage(), "kid.png")).body
      .profilePicturePath as string;
    // A second session for Alice (another device), which must end too.
    await signIn("alice");

    const bob = await signIn("bob");
    const bobsKid = (await bob.post("/api/people").send({ name: "Bob's kid", colorHex: "#00ff00" })).body.id;
    await bob.put(`/api/people/${bobsKid}/visits/TX`);
    await bob.put(`/api/people/${bobsKid}/countries/JP`);
    const bobPhoto = (await bob.post(`/api/people/${bobsKid}/photo`).attach("photo", await pngImage(), "b.png")).body
      .profilePicturePath as string;

    expect((await alice.delete("/api/me")).status).toBe(204);

    const aliceUser = await prisma.user.findFirst({ where: { email: "alice@example.com" } });
    expect(aliceUser).toBeNull();
    expect(await prisma.person.findMany({ where: { name: { in: ["Alice", "Kid"] } } })).toEqual([]);
    expect(await prisma.visitedState.count({ where: { stateCode: "CA" } })).toBe(0);
    expect(await prisma.visitedCountry.count({ where: { countryCode: "FR" } })).toBe(0);
    expect(await prisma.session.count()).toBe(1); // only Bob's
    await expect(fs.access(path.join(UPLOADS_DIR, path.basename(alicePhoto)))).rejects.toThrow();

    // Bob's Person, visits and photo are all still there.
    expect((await bob.get("/api/people")).body).toHaveLength(1);
    expect((await bob.get(`/api/people/${bobsKid}/visits`)).body).toEqual(["TX"]);
    expect((await bob.get(`/api/people/${bobsKid}/countries`)).body).toEqual(["JP"]);
    expect((await bob.get(`/${bobPhoto}`)).status).toBe(200);
  });

  it("signing in again with the same Google account starts fresh as a new User", async () => {
    const before = (await alice.get("/api/me")).body.user.id as string;
    await alice.post("/api/people").send({ name: "Kid", colorHex: "#ff0000" });
    await alice.delete("/api/me");

    const again = newAgent();
    const res = await completeSignIn(again, fakeCode(identityFor("alice")));
    // A brand-new User has no Primary Person, so sign-in goes to the welcome step.
    expect(res.headers.location).toBe("/welcome");
    const me = (await again.get("/api/me")).body;
    expect(me.user.id).not.toBe(before);
    expect(me.primaryPersonId).toBeNull();
    expect((await again.get("/api/people")).body).toEqual([]);
  });
});
