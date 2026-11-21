import type { Response } from "express";
import { Prisma, type User } from "@prisma/client";
import { prisma } from "../db.js";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "./sessions.js";

// What every way of signing in has in common (Phase 13): a Sign-in method, identified by its kind
// and subject, belongs to exactly one User. Signing in with an unknown one creates a User; adding
// one to an account attaches it unless another account already has it. Accounts are never merged.

/** Where a User with no Primary Person yet is sent after signing in. */
export const WELCOME_PATH = "/welcome";

/** The Sign-in methods page, where adding a method starts and ends. */
export const ACCOUNT_SIGN_IN_PATH = "/account/sign-in";

/** The `SignInMethod.kind` values (passkeys have their own table). */
export type MethodKind = "microsoft" | "google" | "github";

/** Who a provider says is signing in. */
export interface MethodIdentity {
  kind: MethodKind;
  /** The provider's stable user id. */
  subject: string;
  /** The account's email, if any. Refreshes the User's display email. */
  email: string | null;
  /** The account's name, if the provider gives one. Refreshes the User's display name. */
  name: string | null;
  /** The provider's profile picture; null when it sends none (Microsoft doesn't). */
  avatarUrl: string | null;
}

/**
 * Whether an error is Prisma's unique-constraint violation, i.e. another request created the same
 * row first.
 * @param error - whatever was thrown.
 * @returns true for P2002.
 */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * The User's display values after signing in with this identity: what the identity provides
 * replaces what's stored, and anything it doesn't provide is kept.
 * @param user - the User's current values.
 * @param identity - who just signed in.
 * @returns the fields to write.
 */
function refreshedDisplay(user: Pick<User, "email" | "displayName" | "avatarUrl">, identity: MethodIdentity) {
  return {
    email: identity.email ?? user.email,
    displayName: identity.name || user.displayName,
    // The provider just used decides the picture, including taking it away (null).
    avatarUrl: identity.avatarUrl,
  };
}

/**
 * Signs in with a Sign-in method: the User who has it, or a brand-new User when nobody does.
 * Refreshes the method's last use and the User's display values.
 * @param identity - who the provider says this is.
 * @returns the User, and whether they were just created.
 */
export async function signInWithMethod(identity: MethodIdentity): Promise<{ user: User; created: boolean }> {
  const where = { kind_subject: { kind: identity.kind, subject: identity.subject } };
  const existing = await prisma.signInMethod.findUnique({ where, include: { user: true } });

  // Known method: that User, with refreshed details.
  if (existing) {
    const [, user] = await prisma.$transaction([
      prisma.signInMethod.update({
        where: { id: existing.id },
        data: { lastUsedAt: new Date(), email: identity.email ?? existing.email },
      }),
      prisma.user.update({ where: { id: existing.userId }, data: refreshedDisplay(existing.user, identity) }),
    ]);
    return { user, created: false };
  }

  try {
    // Unknown method: a new User, created together with the method in one write.
    const user = await prisma.user.create({
      data: {
        email: identity.email,
        displayName: identity.name ?? "",
        avatarUrl: identity.avatarUrl ?? null,
        signInMethods: { create: { kind: identity.kind, subject: identity.subject, email: identity.email } },
      },
    });
    return { user, created: true };
  } catch (error) {
    // The same first sign-in raced in from another tab and won: use the User it created.
    if (isUniqueViolation(error)) return signInWithMethod(identity);
    throw error;
  }
}

/** What happened when adding a Sign-in method to an account. */
export type AttachResult = "attached" | "alreadyYours" | "taken";

/**
 * Adds a Sign-in method to a signed-in User's account, unless another account already has it.
 * @param userId - the signed-in User.
 * @param identity - the method being added.
 * @returns "attached", "alreadyYours" (nothing changes), or "taken" (nothing changes).
 */
export async function attachMethod(userId: string, identity: MethodIdentity): Promise<AttachResult> {
  const where = { kind_subject: { kind: identity.kind, subject: identity.subject } };
  const existing = await prisma.signInMethod.findUnique({ where });
  // Already on an account: this one (fine, nothing to do) or someone else's (never merged).
  if (existing) return existing.userId === userId ? "alreadyYours" : "taken";

  try {
    await prisma.signInMethod.create({
      data: { userId, kind: identity.kind, subject: identity.subject, email: identity.email },
    });
    return "attached";
  } catch (error) {
    // Another account added the same method in the meantime: the unique (kind, subject) decides.
    if (isUniqueViolation(error)) return "taken";
    throw error;
  }
}

/**
 * Starts a session for a User and sets the session cookie on the response.
 * @param res - the response to set the cookie on.
 * @param userId - the User signing in.
 */
export async function startSession(res: Response, userId: string): Promise<void> {
  const token = await createSession(userId);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

/**
 * Where a User goes right after signing in: the welcome step until they have a Primary Person,
 * otherwise the page they were headed for.
 * @param user - the signed-in User.
 * @param returnTo - the (already checked) page they asked for.
 * @returns the path to send them to.
 */
export function landingPath(user: Pick<User, "primaryPersonId">, returnTo: string): string {
  return user.primaryPersonId ? returnTo : WELCOME_PATH;
}
