import path from "node:path";
import { Router } from "express";
import { actorOf, findViewablePersonByPhoto } from "../access.js";
import { UPLOADS_DIR } from "../env.js";

/**
 * `/uploads/*` — profile photos, served only to a signed-in User who can view the Person the
 * photo belongs to (asked of the access policy). Every other case — signed out, someone else's
 * photo, a file no Person uses, a missing file, any other path — is a bare `404`, never
 * `401`/`403`, so photo URLs can't be used to probe whether data exists.
 */
export const photosRouter = Router();

/**
 * `GET /uploads/:fileName` — one profile photo. Sent with `Cache-Control: private, no-cache`:
 * shared caches never keep it, and the browser revalidates every time, so each view goes
 * through the access check again (a cheap 304 when the photo hasn't changed).
 */
photosRouter.get("/:fileName", async (req, res) => {
  const { fileName } = req.params as { fileName: string };
  // The stored path is built the same way the upload route builds it ("uploads/<file>").
  const person = await findViewablePersonByPhoto(actorOf(req), `uploads/${fileName}`);
  // Not viewable and not there look the same to the caller.
  if (!person) {
    res.sendStatus(404);
    return;
  }

  res.setHeader("Cache-Control", "private, no-cache");
  // basename: the name was matched against a stored path, but never let it leave the folder.
  res.sendFile(path.join(UPLOADS_DIR, path.basename(fileName)), { cacheControl: false }, (error) => {
    // A Person points at this file but it's gone from disk: still just "not found". (If headers
    // already went out — the client hung up mid-file — there's nothing left to answer.)
    if (error && !res.headersSent) res.sendStatus(404);
  });
});

// Anything else under /uploads (nested paths, the bare folder) is not found too, rather than
// falling through to the production frontend's index.html.
photosRouter.use((_req, res) => {
  res.sendStatus(404);
});
