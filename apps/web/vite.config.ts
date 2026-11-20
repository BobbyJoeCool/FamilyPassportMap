import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * The installable-app (PWA) plugin for the real app: manifest plus a service worker that caches
 * the app shell. The guest demo leaves it out, so a visitor never gets a stale cached demo.
 * @returns the configured plugin(s).
 */
function pwa() {
  return VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["favicon.svg", "icons.svg"],
    manifest: {
      name: "FamilyPassportMap",
      short_name: "PassportMap",
      description: "Track which US states and countries you and your family have visited.",
      theme_color: "#16171d",
      background_color: "#16171d",
      display: "standalone",
      start_url: "/",
      icons: [
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      navigateFallback: "/index.html",
      // Never answer API calls or photo URLs with the cached app shell: both must reach the
      // server (photos are private, and a signed-out photo URL must come back 404).
      navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
    },
  });
}

/**
 * Copies the built index.html to 404.html. GitHub Pages answers any unknown path with 404.html,
 * so a deep link or reload on /us/compare still loads the app and React Router takes over.
 * @returns the plugin.
 */
function notFoundPageCopy(): Plugin {
  let outDir = "";
  return {
    name: "demo-404-page",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      fs.copyFileSync(path.join(outDir, "index.html"), path.join(outDir, "404.html"));
    },
  };
}

/**
 * A Vite base path with exactly one slash at each end ("/" stays "/").
 * @param value - e.g. "/FamilyPassportMap", "FamilyPassportMap/" or "".
 * @returns e.g. "/FamilyPassportMap/".
 */
function normalizeBase(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
}

export default defineConfig(({ mode }) => {
  // The guest demo build: `vite build --mode demo` (npm run build:demo) or VITE_DEMO=true.
  const demo = mode === "demo" || process.env.VITE_DEMO === "true";

  return {
    // The demo on GitHub Pages lives under a sub-path that the Pages workflow passes in
    // (DEMO_BASE_PATH); the real app is always served from the site root.
    base: demo ? normalizeBase(process.env.DEMO_BASE_PATH ?? "/") : "/",
    // Always defined, so `import.meta.env.VITE_DEMO === "true"` is a constant the bundler can
    // drop as dead code in the normal build (main.tsx relies on that to leave src/demo out).
    define: { "import.meta.env.VITE_DEMO": JSON.stringify(demo ? "true" : "false") },
    // The demo builds next to, never over, the real app's dist/.
    build: demo ? { outDir: "dist-demo", emptyOutDir: true } : {},
    plugins: [react(), tailwindcss(), ...(demo ? [notFoundPageCopy()] : [pwa()])],
    server: {
      // The API server the dev server forwards to. The E2E run points it at its own server
      // (API_PROXY_TARGET), so tests never touch the normal dev server's data.
      proxy: {
        "/api": process.env.API_PROXY_TARGET ?? "http://localhost:3001",
        "/uploads": process.env.API_PROXY_TARGET ?? "http://localhost:3001",
      },
    },
  };
});
