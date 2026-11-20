import crypto from "node:crypto";
import type { EmailCodePurpose } from "@familypassportmap/shared";
import { prisma } from "../db.js";

// Email codes (Phase 13): a 6-digit code proves someone controls an email address. Only the code's
// SHA-256 hash is stored, only the newest code per address and purpose works, and it dies after 10
// minutes or 5 wrong guesses. 6 digits is a million possibilities; 5 guesses per code and the send
// limits (rateLimit.ts) keep guessing hopeless.

/** How long a code works. */
export const CODE_LIFETIME_MS = 10 * 60 * 1000;

/** Wrong guesses allowed before a code stops working. */
export const MAX_CODE_ATTEMPTS = 5;

/**
 * Hashes a code for storage and comparison.
 * @param code - the 6 digits.
 * @returns the SHA-256 hex digest.
 */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Makes a new code for an address, replacing any earlier one for the same address and purpose.
 * @param email - the (normalized) address.
 * @param purpose - "sign-in" or "add-email".
 * @param userId - the signed-in User adding the address ("add-email"), else null.
 * @returns the code to send. Never stored in plain text.
 */
export async function issueCode(email: string, purpose: EmailCodePurpose, userId: string | null): Promise<string> {
  // A cryptographically random number, zero-padded so every code is exactly 6 digits.
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.$transaction([
    // Only the newest code works: earlier ones for this address and purpose go.
    prisma.emailCode.deleteMany({ where: { email, purpose } }),
    prisma.emailCode.create({
      data: { email, purpose, userId, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_LIFETIME_MS) },
    }),
  ]);
  return code;
}

/**
 * Checks a typed code. A right code is used up; a wrong one counts against the code's guesses.
 * @param email - the (normalized) address.
 * @param purpose - "sign-in" or "add-email".
 * @param code - what was typed.
 * @param userId - for "add-email", the signed-in User, who must be the one who asked for the code.
 * @returns true if the code is right and still valid.
 */
export async function checkCode(email: string, purpose: EmailCodePurpose, code: string, userId: string | null): Promise<boolean> {
  const row = await prisma.emailCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: "desc" } });
  // No code asked for (or it was used or replaced).
  if (!row) return false;
  // Expired, or out of guesses: it can never work again, so clean it up.
  if (row.expiresAt.getTime() <= Date.now() || row.attempts >= MAX_CODE_ATTEMPTS) {
    await prisma.emailCode.deleteMany({ where: { id: row.id } });
    return false;
  }
  // An add-email code only works for the account that asked for it.
  if (purpose === "add-email" && row.userId !== userId) return false;

  // Constant-time comparison of the two hashes, so timing can't reveal how close a guess was.
  const matches = crypto.timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(hashCode(code), "hex"));
  if (matches) {
    // Used up: a code works once.
    await prisma.emailCode.deleteMany({ where: { id: row.id } });
    return true;
  }
  // A wrong guess uses up one of the code's tries.
  await prisma.emailCode.updateMany({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
  return false;
}
