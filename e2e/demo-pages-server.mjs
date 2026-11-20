// Serves the built guest demo (apps/web/dist-demo) the way GitHub Pages does, for the demo E2E
// tests: under a base path (/FamilyPassportMap/), a folder answers with its index.html, and any
// path with no file answers 404 with the site's 404.html, which is how a deep link reaches the
// app on Pages. `vite preview` would answer index.html with a 200 instead and hide a missing
// 404.html. Local only; Playwright starts and stops it (see playwright.config.ts).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const distDir = path.resolve(import.meta.dirname, "../apps/web/dist-demo");
const port = Number(process.env.E2E_DEMO_PORT ?? "4273");
const base = process.env.DEMO_BASE_PATH ?? "/FamilyPassportMap/";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

/**
 * Sends a file from the demo build.
 * @param res - the response.
 * @param status - the HTTP status.
 * @param file - the absolute file path.
 */
function sendFile(res, status, file) {
  res.writeHead(status, { "Content-Type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

/**
 * The file a request path maps to, if it exists inside the build: the file itself, or a folder's
 * index.html.
 * @param relative - the path after the base, URL-decoded.
 * @returns the absolute file path, or null.
 */
function fileFor(relative) {
  const candidate = path.resolve(distDir, `.${path.posix.normalize(`/${relative}`)}`);
  // Never serve anything outside the build folder.
  if (!candidate.startsWith(distDir)) return null;
  const file = fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? path.join(candidate, "index.html") : candidate;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    // The base without its trailing slash ("/FamilyPassportMap") redirects to the base, like Pages.
    if (`${pathname}/` === base) {
      res.writeHead(301, { Location: base });
      res.end();
      return;
    }
    // Outside the base path there's no site at all.
    if (!pathname.startsWith(base)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    const file = fileFor(pathname.slice(base.length));
    // A real file is served as-is; anything else gets the site's 404 page with a 404 status.
    if (file) sendFile(res, 200, file);
    else sendFile(res, 404, path.join(distDir, "404.html"));
  })
  .listen(port, () => {
    console.log(`Demo (GitHub Pages stand-in) at http://localhost:${port}${base}`);
  });
