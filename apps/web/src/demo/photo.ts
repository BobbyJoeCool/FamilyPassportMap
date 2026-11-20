// Photo shrinking for the guest demo: what the server does with sharp, done in the browser with a
// canvas. The demo keeps the server's rule: a 256×256 square, center-cropped, in the same format.

/** Profile photos are stored as squares of this many pixels per side (matches the server). */
export const AVATAR_SIZE_PX = 256;

/** The square part of an image to keep: its top-left corner and side length, in source pixels. */
export interface SquareCrop {
  sx: number;
  sy: number;
  size: number;
}

/**
 * The largest centered square inside an image, which is what "cover" resizing to a square keeps.
 * @param width - the image's width in pixels.
 * @param height - the image's height in pixels.
 * @returns the square to crop.
 */
export function centerSquareCrop(width: number, height: number): SquareCrop {
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

/**
 * Shrinks a photo to an `AVATAR_SIZE_PX` square in the browser: decoded (upright, per its EXIF
 * orientation), center-cropped, and re-encoded in its own format. Re-encoding drops metadata such
 * as a GPS location, as the server does.
 * @param file - the uploaded photo (JPEG, PNG or WebP).
 * @returns the shrunk photo, same MIME type.
 * @throws if the bytes can't be decoded as an image, or the canvas can't encode them.
 */
export async function shrinkPhotoInBrowser(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const context = canvas.getContext("2d");
  // A browser that can't give a 2D canvas can't shrink the photo; treat it as unreadable.
  if (!context) throw new Error("No 2D canvas available");

  const { sx, sy, size } = centerSquareCrop(bitmap.width, bitmap.height);
  context.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  bitmap.close();

  return new Promise((resolve, reject) => {
    // toBlob reports failure as a null blob rather than an error.
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the photo"))), file.type);
  });
}
