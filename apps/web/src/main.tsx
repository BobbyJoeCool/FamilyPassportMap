import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { routerBasename } from "./demoMode";

/**
 * Starts the app. In the guest demo build, the in-browser fake API goes in front of `fetch` first,
 * so the app's very first request (GET /api/me) already reaches it.
 */
async function start(): Promise<void> {
  // The flag is replaced with a literal at build time, so in the normal build this branch is dead
  // code and the whole of src/demo is left out (apps/web/scripts/check-no-demo-code.mjs checks).
  if (import.meta.env.VITE_DEMO === "true") {
    const { installDemo } = await import("./demo/install");
    installDemo();
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {/* The demo on GitHub Pages lives under a sub-path; the real app is at the site root. */}
      <BrowserRouter basename={routerBasename(import.meta.env.BASE_URL)}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

void start();
