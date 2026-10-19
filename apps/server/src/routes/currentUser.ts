import { Router } from "express";
import type { CurrentUserResponse } from "@familypassportmap/shared";

/** Router for `/api/me` — the signed-in User. Mounted behind `requireUser`. */
export const currentUserRouter = Router();

/** `GET /api/me` — who is signed in. */
currentUserRouter.get("/", (req, res) => {
  const user = req.user!;
  const response: CurrentUserResponse = {
    user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
  };
  res.json(response);
});
