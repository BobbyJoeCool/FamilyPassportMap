import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { app } from "../src/app.js";
import { shrinkOversizedPhotos } from "../src/photos.js";

/**
 * Builds a solid-color test image.
 * @param width - image width in px.
 * @param height - image height in px.
 * @param format - output format.
 * @returns the encoded image bytes.
 */
function makeImage(width: number, height: number, format: "jpeg" | "png" | "webp"): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#3366cc" } })
    .toFormat(format)
    .toBuffer();
}

/**
 * Creates a Person and uploads a photo for them.
 * @param image - the photo bytes.
 * @param filename - the upload's filename (its extension sets the MIME type).
 * @returns the upload response.
 */
async function uploadFor(image: Buffer, filename: string) {
  const person = await request(app).post("/api/people").send({ name: "Alice", colorHex: "#ff0000" });
  return request(app).post(`/api/people/${person.body.id}/photo`).attach("photo", image, filename);
}

describe("Photo upload shrinking", () => {
  it("shrinks a large JPEG to a 256×256 JPEG", async () => {
    const res = await uploadFor(await makeImage(1200, 800, "jpeg"), "big.jpg");
    expect(res.status).toBe(200);

    const served = await request(app).get(`/${res.body.profilePicturePath}`).responseType("blob");
    expect(served.status).toBe(200);
    const meta = await sharp(served.body as Buffer).metadata();
    expect(meta).toMatchObject({ width: 256, height: 256, format: "jpeg" });
  });

  it.each([
    ["png", "big.png"],
    ["webp", "big.webp"],
  ] as const)("keeps a %s upload in its original format and extension", async (format, filename) => {
    const res = await uploadFor(await makeImage(900, 1400, format), filename);
    expect(res.status).toBe(200);
    expect(res.body.profilePicturePath).toMatch(new RegExp(`\\.${format}$`));

    const served = await request(app).get(`/${res.body.profilePicturePath}`).responseType("blob");
    const meta = await sharp(served.body as Buffer).metadata();
    expect(meta).toMatchObject({ width: 256, height: 256, format });
  });

  it("still rejects a non-image upload", async () => {
    const res = await uploadFor(Buffer.from("not an image"), "notes.txt");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Photo must be JPEG, PNG, or WebP.");
  });

  it("rejects bytes that claim to be an image but aren't", async () => {
    const res = await uploadFor(Buffer.from("definitely not a jpeg"), "fake.jpg");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Photo couldn't be read as an image.");
  });
});

describe("Shrinking photos uploaded before Phase 12", () => {
  it("shrinks oversized photos in place, leaves small ones alone, and is a no-op the second time", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fpm-photos-"));
    const big = path.join(dir, "big.jpg");
    const tall = path.join(dir, "tall.png");
    const small = path.join(dir, "small.png");
    await fs.writeFile(big, await makeImage(1000, 500, "jpeg"));
    await fs.writeFile(tall, await makeImage(200, 300, "png"));
    await fs.writeFile(small, await makeImage(100, 100, "png"));
    const smallBefore = await fs.readFile(small);

    expect(await shrinkOversizedPhotos(dir)).toBe(2);

    expect(await sharp(big).metadata()).toMatchObject({ width: 256, height: 256, format: "jpeg" });
    expect(await sharp(tall).metadata()).toMatchObject({ width: 256, height: 256, format: "png" });
    expect(await fs.readFile(small)).toEqual(smallBefore);

    expect(await shrinkOversizedPhotos(dir)).toBe(0);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
