import { Router } from "express";
import type { Passkey, SignInMethod } from "@prisma/client";
import {
  isProvider,
  LAST_METHOD_MESSAGE,
  passkeyNameSchema,
  PROVIDER_LABELS,
  type SignInMethodKind,
  type SignInMethodsResponse,
  type SignInMethodSummary,
} from "@familypassportmap/shared";
import { prisma } from "../db.js";

/**
 * Router for the signed-in User's own sign-in methods (Phase 13), mounted at `/api/me` behind
 * `requireUser`: list, remove (never the last one), and rename a passkey.
 */
export const signInMethodsRouter = Router();

/**
 * The summary of a provider sign-in method.
 * @param method - the row.
 * @returns what the Sign-in methods page shows.
 */
function summarizeMethod(method: SignInMethod): SignInMethodSummary {
  // A provider account is labelled by its email, or "Google account" when it has none.
  const label = method.email ?? (isProvider(method.kind) ? `${PROVIDER_LABELS[method.kind]} account` : method.subject);
  return {
    id: method.id,
    kind: method.kind as SignInMethodKind,
    label,
    createdAt: method.createdAt.toISOString(),
    lastUsedAt: method.lastUsedAt.toISOString(),
  };
}

/**
 * The summary of a passkey.
 * @param passkey - the row.
 * @returns what the Sign-in methods page shows.
 */
function summarizePasskey(passkey: Passkey): SignInMethodSummary {
  return {
    id: passkey.id,
    kind: "passkey",
    label: passkey.name,
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt.toISOString(),
  };
}

/** `GET /api/me/sign-in-methods` — every way the User can sign in, oldest first. */
signInMethodsRouter.get("/sign-in-methods", async (req, res) => {
  const userId = req.user!.id;
  const [methods, passkeys] = await Promise.all([
    prisma.signInMethod.findMany({ where: { userId } }),
    prisma.passkey.findMany({ where: { userId } }),
  ]);
  // Both kinds in one list, ordered by when each was added.
  const all = [...methods.map(summarizeMethod), ...passkeys.map(summarizePasskey)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const body: SignInMethodsResponse = { methods: all };
  res.json(body);
});

/**
 * `DELETE /api/me/sign-in-methods/:id` — remove one of the User's sign-in methods (provider or
 * passkey). The last one can't go: the count and the delete happen in one transaction, so two
 * removals at once can't both pass the check.
 */
signInMethodsRouter.delete("/sign-in-methods/:id", async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const outcome = await prisma.$transaction(async (tx) => {
    const [method, passkey] = await Promise.all([
      tx.signInMethod.findFirst({ where: { id, userId } }),
      tx.passkey.findFirst({ where: { id, userId } }),
    ]);
    // Not this User's (or doesn't exist): the same "not found" either way.
    if (!method && !passkey) return "notFound" as const;
    const total = (await tx.signInMethod.count({ where: { userId } })) + (await tx.passkey.count({ where: { userId } }));
    // Removing the only one would lock the User out for good.
    if (total <= 1) return "last" as const;
    if (method) await tx.signInMethod.delete({ where: { id } });
    else await tx.passkey.delete({ where: { id } });
    return "deleted" as const;
  });

  // One response per outcome.
  if (outcome === "notFound") {
    res.status(404).json({ error: "Sign-in method not found" });
    return;
  }
  if (outcome === "last") {
    res.status(409).json({ error: LAST_METHOD_MESSAGE });
    return;
  }
  res.status(204).end();
});

/** `PATCH /api/me/passkeys/:id` with `{ name }` — rename one of the User's passkeys. */
signInMethodsRouter.patch("/passkeys/:id", async (req, res) => {
  const name = passkeyNameSchema.safeParse(req.body?.name);
  // Empty or too long.
  if (!name.success) {
    res.status(400).json({ error: name.error.issues[0].message });
    return;
  }
  const passkey = await prisma.passkey.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  // Not this User's passkey.
  if (!passkey) {
    res.status(404).json({ error: "Passkey not found" });
    return;
  }
  const updated = await prisma.passkey.update({ where: { id: passkey.id }, data: { name: name.data } });
  res.json(summarizePasskey(updated));
});
