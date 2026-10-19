import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { resolveSession, SESSION_COOKIE, sessionCookieOptions } from "./sessions.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The signed-in User, set by `loadUser` when the request carries a valid session. */
      user?: User;
    }
  }
}

/**
 * Reads the session cookie and, if it's valid, attaches the signed-in User to the request.
 * Never rejects a request on its own — `requireUser` decides that.
 * @param req - the incoming request (needs cookie-parser to have run).
 * @param res - the response; the session cookie is re-sent when its expiry slides forward.
 * @param next - continues to the next handler.
 */
export async function loadUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  // No session cookie at all — the request is simply signed out.
  if (typeof token !== "string" || token === "") {
    next();
    return;
  }

  const session = await resolveSession(token);
  if (session) {
    req.user = session.user;
    // The server-side expiry just moved forward; move the cookie's Max-Age with it.
    if (session.extended) res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  }
  next();
}

/**
 * Rejects requests that aren't signed in with `401 { error: "Not signed in" }`.
 * @param req - the incoming request (after `loadUser`).
 * @param res - the response.
 * @param next - continues to the protected route.
 */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  // Signed-out: the client treats any 401 as "go to /signin".
  if (!req.user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  next();
}
