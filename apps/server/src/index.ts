import "dotenv/config";
import { app } from "./app.js";
import { UPLOADS_DIR } from "./env.js";
import { shrinkOversizedPhotos } from "./photos.js";

// Prefer the platform-assigned PORT (e.g. Azure App Service) if present; otherwise use
// the local development default.
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// Shrink any photos uploaded before uploads were shrunk (Phase 12). Runs every start but
// finds nothing to do once they're all small. A failure here is logged, never fatal — a
// photo cleanup must not keep the site down.
try {
  const shrunk = await shrinkOversizedPhotos(UPLOADS_DIR);
  // Only worth a log line when something actually changed.
  if (shrunk > 0) console.log(`Shrank ${shrunk} oversized photo(s) in ${UPLOADS_DIR}`);
} catch (error) {
  console.error("Shrinking existing photos failed:", error);
}

/**
 * Starts the Express app listening for HTTP requests. This is the process entry point —
 * `app.ts` only builds the app, it never starts it, so it can be imported by tests
 * (see apps/server/tests) without also binding a port.
 */
app.listen(port, () => {
  console.log(`FamilyPassportMap server listening on http://localhost:${port}`);
});
