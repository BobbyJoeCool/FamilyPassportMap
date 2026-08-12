import { z } from "zod";

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #3366CC");

export const createPersonSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  colorHex: hexColorSchema,
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  colorHex: hexColorSchema.optional(),
});
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

// API response shape — createdAt is an ISO 8601 string over the wire, not a Date.
export interface Person {
  id: string;
  name: string;
  colorHex: string;
  profilePicturePath: string | null;
  createdAt: string;
}

export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, per Documentation/Phase-1-Data-Layer-People.md
