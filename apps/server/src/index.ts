import "dotenv/config";
import { app } from "./app.js";

// Prefer the platform-assigned PORT (e.g. Azure App Service) if present; otherwise use
// the local development default.
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

/**
 * Starts the Express app listening for HTTP requests. This is the process entry point —
 * `app.ts` only builds the app, it never starts it, so it can be imported by tests
 * (see apps/server/tests) without also binding a port.
 */
app.listen(port, () => {
  console.log(`FamilyPassportMap server listening on http://localhost:${port}`);
});
