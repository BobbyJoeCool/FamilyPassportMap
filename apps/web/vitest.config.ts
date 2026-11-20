import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Unit tests for the web app: components and pages rendered with React Testing Library in jsdom.
// Kept apart from vite.config.ts so the PWA and Tailwind plugins don't run for tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // The world map lays out 240-odd country shapes in jsdom, which is slow on a cold start.
    testTimeout: 15000,
  },
});
