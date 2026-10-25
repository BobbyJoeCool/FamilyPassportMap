import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it, expect } from "vitest";

const run = promisify(execFile);
const serverRoot = path.resolve(import.meta.dirname, "..");

describe("Server startup", () => {
  it("refuses to start in production without the Microsoft sign-in settings", async () => {
    // Start the real entry point. The settings are set to empty strings (not deleted) so a
    // developer's local .env can't fill them in — dotenv never overrides existing variables.
    const start = run(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: serverRoot,
      env: { ...process.env, NODE_ENV: "production", PORT: "0", MICROSOFT_CLIENT_ID: "", MICROSOFT_CLIENT_SECRET: "", APP_BASE_URL: "" },
      // If the check were missing, the server would start and listen forever.
      timeout: 10_000,
    });

    await expect(start).rejects.toMatchObject({
      killed: false,
      stderr: expect.stringContaining(
        "Refusing to start: missing app settings MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, APP_BASE_URL",
      ),
    });
  });
});
