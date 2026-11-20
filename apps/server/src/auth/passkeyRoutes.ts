import crypto from "node:crypto";
import { Router, type CookieOptions, type Request, type Response } from "express";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { DEFAULT_PASSKEY_NAME, passkeyNameSchema, safeReturnTo, type SignInResult } from "@familypassportmap/shared";
import { prisma } from "../db.js";
import { appBaseUrl } from "./config.js";
import { landingPath, startSession, WELCOME_PATH } from "./signInMethods.js";

// Passkeys (Phase 13), built on @simplewebauthn/server. A passkey is a key pair the visitor's device
// (or password manager) creates for this site: the private key never leaves the device, and the
// server keeps only the public key. Signing in means the device signs a fresh random "challenge"
// from the server, which the server checks with the stored public key.
//
// Passkeys are tied to a domain (the "relying party id"): APP_BASE_URL's hostname, so
// passport.bobbyjoecool.dev in production and localhost in development. Each step is two calls:
// "options" (the server makes a challenge and remembers it for 5 minutes, keyed by a short-lived
// cookie) and "verify" (the browser's answer, checked against that challenge).

/** Router for `/api/auth/passkey`. Public; `loadUser` has already run. */
export const passkeyRouter = Router();

/** The name devices show for this site when saving or offering a passkey. */
const RP_NAME = "FamilyPassportMap";

/** How long a challenge stays usable. */
const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;

/** Cookie that ties a browser to its pending challenge. */
const CHALLENGE_COOKIE = "fpm_passkey";

/** A challenge waiting for the browser's answer. */
interface PendingChallenge {
  challenge: string;
  purpose: "register" | "sign-in";
  /** Registering while signed in (adding a passkey): the User it's for. Null when signing up. */
  userId: string | null;
  expiresAt: number;
}

/**
 * Pending challenges, by the random id in the browser's cookie. In memory is enough for one server:
 * a restart only means a visitor midway through has to press the button again.
 */
const pendingChallenges = new Map<string, PendingChallenge>();

/**
 * Cookie settings for the challenge cookie: only sent to the passkey routes, gone in 5 minutes.
 * @returns options for `res.cookie` / `res.clearCookie`.
 */
function challengeCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/passkey",
    maxAge: CHALLENGE_LIFETIME_MS,
  };
}

/**
 * Remembers a new challenge and gives the browser its cookie.
 * @param res - the response to set the cookie on.
 * @param pending - the challenge and what it's for.
 */
function rememberChallenge(res: Response, pending: Omit<PendingChallenge, "expiresAt">): void {
  // Forget expired challenges while we're here, so the map can't grow without limit.
  const now = Date.now();
  for (const [id, entry] of pendingChallenges) if (entry.expiresAt <= now) pendingChallenges.delete(id);

  const id = crypto.randomBytes(16).toString("base64url");
  pendingChallenges.set(id, { ...pending, expiresAt: now + CHALLENGE_LIFETIME_MS });
  res.cookie(CHALLENGE_COOKIE, id, challengeCookieOptions());
}

/**
 * Takes this browser's pending challenge (each one is usable once).
 * @param req - the request carrying the challenge cookie.
 * @param res - the response, to clear the cookie.
 * @param purpose - what the challenge must have been made for.
 * @returns the challenge, or null if missing, expired, or made for something else.
 */
function takeChallenge(req: Request, res: Response, purpose: PendingChallenge["purpose"]): PendingChallenge | null {
  const id: unknown = req.cookies?.[CHALLENGE_COOKIE];
  res.clearCookie(CHALLENGE_COOKIE, challengeCookieOptions());
  // No cookie: this browser never asked for options.
  if (typeof id !== "string") return null;
  const pending = pendingChallenges.get(id);
  pendingChallenges.delete(id);
  // Unknown, expired, or a sign-in challenge used to register (or the other way round).
  if (!pending || pending.expiresAt <= Date.now() || pending.purpose !== purpose) return null;
  return pending;
}

/**
 * The relying party: the domain passkeys are tied to, and the exact origin answers must come from.
 * @returns the RP id (hostname) and origin, from APP_BASE_URL.
 */
function relyingParty(): { rpID: string; origin: string } {
  const base = appBaseUrl();
  return { rpID: base.hostname, origin: base.origin };
}

/**
 * Parses a stored transports list.
 * @param stored - the JSON text, or null.
 * @returns the transports, or undefined.
 */
function parseTransports(stored: string | null): string[] | undefined {
  return stored ? (JSON.parse(stored) as string[]) : undefined;
}

/** Sent when the browser's answer doesn't match a live challenge. */
const EXPIRED_MESSAGE = "That took too long. Try again.";

/**
 * `POST /api/auth/passkey/register/options` — start creating a passkey: for a new account when
 * signed out, or to add to the account when signed in. Answers the options the browser passes to
 * the device.
 */
passkeyRouter.post("/register/options", async (req, res) => {
  const { rpID } = relyingParty();
  const user = req.user;
  // Adding: the device should refuse to make a second passkey for this account.
  const existing = user ? await prisma.passkey.findMany({ where: { userId: user.id } }) : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    // The user handle stored on the device: the account's id when adding, otherwise random (the
    // account doesn't exist until the passkey is verified; passkeys are found by credential id).
    userID: user ? new TextEncoder().encode(user.id) : crypto.randomBytes(16),
    // What the device shows next to this passkey in its list.
    userName: user ? user.email || user.displayName || "FamilyPassportMap account" : "FamilyPassportMap account",
    // No attestation: we don't need to know which brand of device made it.
    attestationType: "none",
    excludeCredentials: existing.map((passkey) => ({ id: passkey.credentialId, transports: parseTransports(passkey.transports) })),
    // Discoverable ("resident") keys, so signing in needs no username; verification preferred.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  rememberChallenge(res, { challenge: options.challenge, purpose: "register", userId: user?.id ?? null });
  res.json(options);
});

/**
 * `POST /api/auth/passkey/register/verify` with `{ response, name? }` — check the device's new
 * passkey and store its public key. Signed out, that creates a new account (signed in, answers
 * `{ redirectTo: "/welcome" }`); signed in, it's added to the account (`204`).
 */
passkeyRouter.post("/register/verify", async (req, res) => {
  const pending = takeChallenge(req, res, "register");
  // No live challenge for this browser.
  if (!pending) {
    res.status(400).json({ error: EXPIRED_MESSAGE });
    return;
  }
  // A challenge made for adding must be finished by that same signed-in User.
  if (pending.userId && pending.userId !== req.user?.id) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const name = req.body?.name === undefined ? { success: true as const, data: DEFAULT_PASSKEY_NAME } : passkeyNameSchema.safeParse(req.body.name);
  // A name was given but isn't usable.
  if (!name.success) {
    res.status(400).json({ error: name.error.issues[0].message });
    return;
  }

  const { rpID, origin } = relyingParty();
  let registration;
  try {
    registration = await verifyRegistrationResponse({
      response: req.body?.response as RegistrationResponseJSON,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (error) {
    console.error("Passkey registration didn't verify:", error);
    registration = { verified: false as const };
  }
  // Wrong challenge, wrong site, or a malformed answer.
  if (!registration.verified) {
    res.status(400).json({ error: "That passkey couldn't be set up. Try again." });
    return;
  }

  const { credential } = registration.registrationInfo;
  const passkeyData = {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    signCount: credential.counter,
    transports: credential.transports ? JSON.stringify(credential.transports) : null,
    name: name.data,
  };
  // The same credential can't belong to two accounts (credential ids are random, so this is rare).
  if (await prisma.passkey.findUnique({ where: { credentialId: credential.id } })) {
    res.status(409).json({ error: "That passkey is already registered." });
    return;
  }

  // Adding to the signed-in account.
  if (pending.userId) {
    await prisma.passkey.create({ data: { ...passkeyData, userId: pending.userId } });
    res.status(204).end();
    return;
  }

  // Signing up: a new account with no email and no name yet (the welcome step names it).
  const user = await prisma.user.create({ data: { email: null, displayName: "", passkeys: { create: passkeyData } } });
  await startSession(res, user.id);
  const body: SignInResult = { redirectTo: WELCOME_PATH };
  res.json(body);
});

/**
 * `POST /api/auth/passkey/signin/options` — start signing in with a passkey. No username: the
 * browser offers whichever passkeys it has for this site.
 */
passkeyRouter.post("/signin/options", async (_req, res) => {
  const { rpID } = relyingParty();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
  rememberChallenge(res, { challenge: options.challenge, purpose: "sign-in", userId: null });
  res.json(options);
});

/**
 * `POST /api/auth/passkey/signin/verify` with `{ response, returnTo }` — check the device's
 * signature with the stored public key, then sign in as the passkey's User.
 */
passkeyRouter.post("/signin/verify", async (req, res) => {
  const pending = takeChallenge(req, res, "sign-in");
  // No live challenge for this browser.
  if (!pending) {
    res.status(400).json({ error: EXPIRED_MESSAGE });
    return;
  }
  const response = req.body?.response as AuthenticationResponseJSON | undefined;
  const passkey = typeof response?.id === "string" ? await prisma.passkey.findUnique({ where: { credentialId: response.id } }) : null;
  // A passkey this site never registered (or that was removed).
  if (!passkey) {
    res.status(400).json({ error: "That passkey isn't set up for this site. Sign in another way and add it." });
    return;
  }

  const { rpID, origin } = relyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response!,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.signCount,
        transports: parseTransports(passkey.transports),
      },
      requireUserVerification: false,
    });
  } catch (error) {
    // Includes a sign count that went backwards, a sign the passkey may have been copied.
    console.error("Passkey sign-in didn't verify:", error);
    verification = null;
  }
  // A bad signature, the wrong challenge or site, or a suspicious sign count.
  if (!verification?.verified) {
    res.status(400).json({ error: "That passkey couldn't be checked. Try again." });
    return;
  }

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { signCount: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: passkey.userId } });
  await startSession(res, user.id);
  const body: SignInResult = { redirectTo: landingPath(user, safeReturnTo(req.body?.returnTo)) };
  res.json(body);
});
