import crypto from "node:crypto";
import multer from "multer";
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_SIZE_BYTES } from "@familypassportmap/shared";
import { UPLOADS_DIR } from "./env.js";

const EXTENSION_BY_MIME_TYPE: Record<(typeof ALLOWED_PHOTO_MIME_TYPES)[number], string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  // Generate the filename ourselves — never derive any part of the on-disk path from
  // client-supplied input (originalname), so there's nothing to sanitize or traverse.
  filename: (_req, file, callback) => {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype as keyof typeof EXTENSION_BY_MIME_TYPE];
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

export const uploadPhoto = multer({
  storage,
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) {
      callback(new Error("Photo must be JPEG, PNG, or WebP."));
      return;
    }
    callback(null, true);
  },
});
