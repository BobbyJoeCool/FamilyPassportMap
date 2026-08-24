import path from "node:path";
import express from "express";
import { UPLOADS_DIR } from "./env.js";
import { peopleRouter } from "./routes/people.js";
import { bulkVisitsRouter, visitsRouter } from "./routes/visits.js";

/**
 * The Express application: routes, middleware, and (in production) the static frontend.
 * Built here rather than in `index.ts` so tests can import it directly without also
 * starting a listener.
 */
export const app = express();

app.use(express.json());

/** Liveness/readiness check — used by deployment tooling to confirm the server is up. */
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/people", peopleRouter);
app.use("/api/people/:id/visits", visitsRouter);
app.use("/api/visits", bulkVisitsRouter);
app.use("/uploads", express.static(UPLOADS_DIR));

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
