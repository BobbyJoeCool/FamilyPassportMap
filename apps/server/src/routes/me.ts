import { Router } from "express";
import type { Me } from "@familypassportmap/shared";

/** Router for `/api/me` — the signed-in User. Mounted behind `requireUser`. */
export const meRouter = Router();

/** `GET /api/me` — who is signed in. */
meRouter.get("/", (req, res) => {
  const user = req.user!;
  const me: Me = {
    user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
  };
  res.json(me);
});
