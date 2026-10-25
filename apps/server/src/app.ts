import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { loadUser, requireUser } from "./auth/middleware.js";
import { authRouter } from "./auth/routes.js";
import { bulkCountriesRouter, countriesRouter } from "./routes/countries.js";
import { currentUserRouter } from "./routes/currentUser.js";
import { peopleRouter } from "./routes/people.js";
import { photosRouter } from "./routes/photos.js";
import { bulkVisitsRouter, visitsRouter } from "./routes/visits.js";

/**
 * The Express application: routes, middleware, and (in production) the static frontend.
 * Built here rather than in `index.ts` so tests can import it directly without also
 * starting a listener.
 */
export const app = express();

app.use(express.json());
app.use(cookieParser());
// Attach the signed-in User (if any) to API and photo requests. Not run for the static
// frontend, which needs no session and would otherwise cost a database lookup per asset.
app.use(["/api", "/uploads"], loadUser);

/** Liveness/readiness check — used by deployment tooling to confirm the server is up. */
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
// Everything below under /api requires a signed-in User (health and auth are above, public).
app.use("/api", requireUser);
app.use("/api/me", currentUserRouter);
app.use("/api/people", peopleRouter);
app.use("/api/people/:id/visits", visitsRouter);
app.use("/api/visits", bulkVisitsRouter);
app.use("/api/people/:id/countries", countriesRouter);
app.use("/api/countries", bulkCountriesRouter);
// Photos are private: served only to Users who can view their Person (no static hosting).
app.use("/uploads", photosRouter);

/**
 * Last-resort error handler for the API. A Person can be deleted between a route's access
 * check and its write (e.g. in another tab); Prisma then reports the vanished row as P2025
 * ("record not found") or P2003 (foreign key — a visit for a Person who no longer exists).
 * Both mean "Person not found", not a server error. Everything else falls through to
 * Express's default 500 handling.
 * @param error - whatever a route threw.
 * @param _req - the request (unused).
 * @param res - the response.
 * @param next - passes unrecognized errors on.
 */
function handlePersonVanished(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  // Only the two "row is gone" codes are translated; anything else is a real failure.
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
    res.status(404).json({ error: "Person not found" });
    return;
  }
  next(error);
}
app.use("/api", handlePersonVanished);

// In production, the same Express process also serves the built frontend, so one
// deployment (Azure App Service) covers both the API and the web app.
if (process.env.NODE_ENV === "production") {
  // Resolve from this compiled file's own location (apps/server/dist) up to the built
  // frontend at apps/web/dist, so it works regardless of the process's cwd.
  const webDist = path.resolve(import.meta.dirname, "../../web/dist");
  app.use(express.static(webDist));
  // Client-side routing catch-all: any path not already matched above falls back to
  // index.html so React Router can handle it in the browser.
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}
