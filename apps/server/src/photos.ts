import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Profile photos are stored as squares of this many pixels per side. */
export const AVATAR_SIZE_PX = 256;

/**
 * Shrinks a photo file in place to an `AVATAR_SIZE_PX` square: rotated upright per its EXIF
 * orientation, center-cropped, and re-encoded in its ORIGINAL format so its path and
 * extension never change. Metadata (including any GPS location) is dropped by the re-encode.
 * @param filePath - absolute path of the photo on disk.
 * @throws if the file isn't a readable image.
 */
export async function shrinkPhoto(filePath: string): Promise<void> {
  // Read fully into memory first so sharp isn't reading the file we're about to overwrite.
  const input = await fs.readFile(filePath);
  const output = await sharp(input)
    .rotate()
    .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover", position: "centre" })
    .toBuffer();
  await fs.writeFile(filePath, output);
}

/**
 * One-time-in-effect cleanup for photos uploaded before uploads were shrunk: shrinks every
 * image in `dir` that is larger than `AVATAR_SIZE_PX` on either side. Safe to run on every
 * startup — once everything is small, it changes nothing.
 * @param dir - the uploads directory.
 * @returns how many files were shrunk.
 */
export async function shrinkOversizedPhotos(dir: string): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let shrunk = 0;

  // Check every regular file; anything sharp can't read (stray non-image files) is skipped.
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(dir, entry.name);

    let width: number | undefined;
    let height: number | undefined;
    try {
      ({ width, height } = await sharp(await fs.readFile(filePath)).metadata());
    } catch {
      continue;
    }

    // Only photos bigger than an avatar on either side need work; small ones stay untouched.
    if ((width ?? 0) > AVATAR_SIZE_PX || (height ?? 0) > AVATAR_SIZE_PX) {
      await shrinkPhoto(filePath);
      shrunk += 1;
    }
  }

  return shrunk;
}
