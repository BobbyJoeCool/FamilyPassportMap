import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: a real browser against local servers only (never Azure). The API server gets
// a fresh SQLite database each run and the E2E fake sign-in (see e2e/start-server.mjs); the web
// app runs on Vite's dev server, proxying to that API. Both use their own ports, so a normal
// `npm run dev` can keep running alongside.
const API_PORT = process.env.E2E_API_PORT ?? "3101";
const WEB_PORT = process.env.E2E_WEB_PORT ?? "5273";
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
  },
  projects: [
    // Signs in the seeded Users once and saves their sessions for the specs that read their data.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node e2e/start-server.mjs",
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_API_PORT: API_PORT, E2E_WEB_PORT: WEB_PORT },
      // Always a fresh server: reusing one would reuse its database.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -w apps/web -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
