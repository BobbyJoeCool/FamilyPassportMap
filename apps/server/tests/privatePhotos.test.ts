import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { UPLOADS_DIR } from "../src/env.js";
import { newAgent, signIn, type TestAgent } from "./helpers.js";

let alice: TestAgent;
let photoUrl: string;

// Alice owns a Person with a photo; each test asks for that photo as someone else (or as her).
beforeEach(async () => {
  alice = await signIn("alice");
  const person = await alice.post("/api/people").send({ name: "Kid", colorHex: "#ff0000" });
  const image = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#3366cc" } })
    .png()
    .toBuffer();
  const upload = await alice.post(`/api/people/${person.body.id}/photo`).attach("photo", image, "kid.png");
  photoUrl = `/${upload.body.profilePicturePath}`;
});

describe("Private photos", () => {
  it("serves a photo to the Owner of its Person", async () => {
    const res = await alice.get(photoUrl);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
  });

  it("returns 404 to a signed-out request", async () => {
    const res = await newAgent().get(photoUrl);
    expect(res.status).toBe(404);
  });

  it("returns 404 to another User", async () => {
    const bob = await signIn("bob");
    const res = await bob.get(photoUrl);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a file name no Person has", async () => {
    const res = await alice.get("/uploads/00000000-0000-0000-0000-000000000000.png");
    expect(res.status).toBe(404);
  });

  it("returns 404 for a replaced photo that's still on disk", async () => {
    // Uploading a new photo leaves the old file behind; it belongs to nobody now.
    const people = await alice.get("/api/people");
    const image = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#00aa00" } })
      .png()
      .toBuffer();
    await alice.post(`/api/people/${people.body[0].id}/photo`).attach("photo", image, "new.png");

    const res = await alice.get(photoUrl);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the Person's photo file is missing from disk", async () => {
    await fs.rm(path.join(UPLOADS_DIR, path.basename(photoUrl)));
    const res = await alice.get(photoUrl);
    expect(res.status).toBe(404);
  });

  it("returns 404 for any other path under /uploads", async () => {
    expect((await alice.get("/uploads/")).status).toBe(404);
    expect((await alice.get(`/uploads/nested${photoUrl}`)).status).toBe(404);
  });

  it("tells caches not to share or keep the photo without asking again", async () => {
    const res = await alice.get(photoUrl);
    expect(res.headers["cache-control"]).toBe("private, no-cache");
  });
});
