import { Router } from "express";
import {
  EMAIL_CODE_FAILED_MESSAGE,
  emailCodeStartSchema,
  emailCodeVerifySchema,
  safeReturnTo,
  TAKEN_MESSAGE,
  type SignInResult,
} from "@familypassportmap/shared";
import { prisma } from "../db.js";
import { isEmailCodesEnabled } from "./config.js";
import { checkCode, issueCode } from "./emailCodes.js";
import { emailCodeMessage, sendMail } from "./mailer.js";
import { clientIp, codesPerAddress, codesPerIp } from "./rateLimit.js";
import { attachMethod, landingPath, signInWithMethod, startSession } from "./signInMethods.js";

/**
 * Router for `/api/auth/email` — sign in (or up) with an Email code, or add an email address to the
 * signed-in account. Mounted on the public auth router; `loadUser` has already run.
 */
export const emailRouter = Router();

// Without a mail service there are no email codes: the routes behave as if they don't exist.
emailRouter.use((_req, res, next) => {
  if (!isEmailCodesEnabled()) {
    res.sendStatus(404);
    return;
  }
  next();
});

/**
 * Whether another account already signs in with this address.
 * @param email - the (normalized) address.
 * @param userId - the signed-in User.
 * @returns true if a different User has it.
 */
async function isTakenByAnotherUser(email: string, userId: string): Promise<boolean> {
  const method = await prisma.signInMethod.findUnique({ where: { kind_subject: { kind: "email", subject: email } } });
  return !!method && method.userId !== userId;
}

/**
 * `POST /api/auth/email/start` with `{ email, purpose }` — send a code. Always `204` with nothing
 * to tell apart, whether or not the address has an account, whether or not a rate limit stopped the
 * send, so this can't be used to find out who has an account here.
 */
emailRouter.post("/start", async (req, res) => {
  const parsed = emailCodeStartSchema.safeParse(req.body);
  // Not a valid address: say so (that reveals nothing about any account).
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, purpose } = parsed.data;
  // Adding an address needs an account to add it to.
  if (purpose === "add-email" && !req.user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  // Both limits are checked (and counted) on every request, not just the first that fails.
  const underAddressLimit = codesPerAddress.allow(email);
  const underIpLimit = codesPerIp.allow(clientIp(req));
  // An address already on this or another account gets no add-email code: nothing to add, or it
  // isn't theirs to add (verify then reports "taken").
  const alreadyOnAnAccount =
    purpose === "add-email" &&
    !!(await prisma.signInMethod.findUnique({ where: { kind_subject: { kind: "email", subject: email } } }));

  if (underAddressLimit && underIpLimit && !alreadyOnAnAccount) {
    const code = await issueCode(email, purpose, req.user?.id ?? null);
    // Sent in the background: waiting would make the response slower for real addresses, and a
    // mail failure is logged rather than shown (the visitor can just send a new code).
    sendMail(emailCodeMessage(email, code)).catch((error: unknown) => {
      console.error("Sending an email code failed:", error);
    });
  }
  res.status(204).end();
});

/**
 * `POST /api/auth/email/verify` with `{ email, code, purpose, returnTo }` — check the code. For
 * "sign-in", signs in as the User with that address (or a new User) and answers `{ redirectTo }`.
 * For "add-email", adds the address to the signed-in User and answers `204`.
 */
emailRouter.post("/verify", async (req, res) => {
  const parsed = emailCodeVerifySchema.safeParse(req.body);
  // A malformed address gets its own message; anything else wrong is "the code didn't work".
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.find((issue) => issue.path[0] === "email");
    res.status(400).json({ error: emailIssue?.message ?? EMAIL_CODE_FAILED_MESSAGE });
    return;
  }
  const { email, code, purpose, returnTo } = parsed.data;

  // Adding an address: needs an account, and the address mustn't be someone else's.
  if (purpose === "add-email") {
    if (!req.user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    if (await isTakenByAnotherUser(email, req.user.id)) {
      res.status(409).json({ error: TAKEN_MESSAGE });
      return;
    }
  }

  // Wrong, expired, used up or never sent: all the same message.
  if (!(await checkCode(email, purpose, code, req.user?.id ?? null))) {
    res.status(400).json({ error: EMAIL_CODE_FAILED_MESSAGE });
    return;
  }

  const identity = { kind: "email" as const, subject: email, email, name: null };
  // Adding: attach to the signed-in account (a race with another account still ends as "taken").
  if (purpose === "add-email") {
    const outcome = await attachMethod(req.user!.id, identity);
    if (outcome === "taken") {
      res.status(409).json({ error: TAKEN_MESSAGE });
      return;
    }
    res.status(204).end();
    return;
  }

  // Signing in: the User with this address, or a new one.
  const { user } = await signInWithMethod(identity);
  await startSession(res, user.id);
  const body: SignInResult = { redirectTo: landingPath(user, safeReturnTo(returnTo)) };
  res.json(body);
});
