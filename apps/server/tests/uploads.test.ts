import fs from "node:fs/promises";
import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import { MAX_PHOTO_SIZE_BYTES } from "@familypassportmap/shared";
import { UPLOADS_DIR } from "../src/env.js";
import { signIn, type TestAgent } from "./helpers.js";

// Upload edge cases photos.test.ts doesn't cover: the size limit, a missing file, the type check
// by MIME type alone, and that nothing is left on disk after a refusal.

let api: TestAgent;
let personId: string;

beforeEach(async () => {
  api = await signIn("alice");
  personId = (await api.post("/api/people").send({ name: "Alice", colorHex: "#3366cc" })).body.id;
});

/**
 * Lists the files currently in the uploads folder.
 * @returns their names.
 */
function uploadedFiles(): Promise<string[]> {
  return fs.readdir(UPLOADS_DIR);
}

describe("Photo upload limits", () => {
  it("rejects a file over 5 MB, keeping nothing on disk", async () => {
    const before = await uploadedFiles();
    const tooBig = Buffer.alloc(MAX_PHOTO_SIZE_BYTES + 1, 0);
    const res = await api.post(`/api/people/${personId}/photo`).attach("photo", tooBig, "big.png");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("File too large");
    expect(await uploadedFiles()).toEqual(before);
  });

  it("accepts a real image just under the limit", async () => {
    const image = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#ff0000" } })
      .png()
      .toBuffer();
    expect(image.length).toBeLessThan(MAX_PHOTO_SIZE_BYTES);
    const res = await api.post(`/api/people/${personId}/photo`).attach("photo", image, "ok.png");
    expect(res.status).toBe(200);
    expect(res.body.profilePicturePath).toMatch(/^uploads\/[0-9a-f-]+\.png$/);
  });

  it("rejects a request with no photo field", async () => {
    const res = await api.post(`/api/people/${personId}/photo`).field("note", "no file here");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No photo uploaded");
  });

  it("rejects a disallowed MIME type even with an image extension", async () => {
    const res = await api
      .post(`/api/people/${personId}/photo`)
      .attach("photo", Buffer.from("GIF89a"), { filename: "anim.gif", contentType: "image/gif" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Photo must be JPEG, PNG, or WebP.");
  });

  it("never uses the client's filename on disk", async () => {
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#00ff00" } })
      .jpeg()
      .toBuffer();
    const res = await api.post(`/api/people/${personId}/photo`).attach("photo", image, "../../etc/passwd.jpg");
    expect(res.status).toBe(200);
    expect(res.body.profilePicturePath).not.toContain("passwd");
    expect(res.body.profilePicturePath).toMatch(/^uploads\/[0-9a-f-]+\.jpg$/);
  });

  it("writes nothing for a Person the User can't edit", async () => {
    const other = await signIn("bob");
    const before = await uploadedFiles();
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#00ff00" } })
      .png()
      .toBuffer();
    const res = await other.post(`/api/people/${personId}/photo`).attach("photo", image, "x.png");
    expect(res.status).toBe(404);
    expect(await uploadedFiles()).toEqual(before);
  });
});
