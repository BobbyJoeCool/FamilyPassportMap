import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it, expect } from "vitest";

const run = promisify(execFile);
const serverRoot = path.resolve(import.meta.dirname, "..");

describe("Server startup", () => {
  it("refuses to start in production without APP_BASE_URL and a sign-in method", async () => {
    // Start the real entry point. The settings are set to empty strings (not deleted) so a
    // developer's local .env can't fill them in — dotenv never overrides existing variables.
    const start = run(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: serverRoot,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "0",
        APP_BASE_URL: "",
        MICROSOFT_CLIENT_ID: "",
        MICROSOFT_CLIENT_SECRET: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        GITHUB_CLIENT_ID: "",
        GITHUB_CLIENT_SECRET: "",
      },
      // If the check were missing, the server would start and listen forever.
      timeout: 10_000,
    });

    await expect(start).rejects.toMatchObject({
      killed: false,
      stderr: expect.stringContaining(
        "Refusing to start: missing app setting APP_BASE_URL; no sign-in provider is configured",
      ),
    });
  });
});
