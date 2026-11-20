// Fails the normal web build if any guest-demo code made it into dist/. main.tsx loads src/demo only
// behind the VITE_DEMO build flag, which the bundler should drop as dead code; this proves it did,
// by searching the built files for strings that exist only in src/demo.
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(import.meta.dirname, "../dist");
// Each marker appears only in src/demo (fakeApi.ts and seed.ts).
const MARKERS = ["Not available in the demo.", "demo-seed-marge"];

/**
 * Every file under a folder, recursively.
 * @param dir - the folder to walk.
 * @returns absolute file paths.
 */
function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(full) : [full];
  });
}

// No dist/ means the build didn't run; that's a broken setup, not a pass.
if (!fs.existsSync(distDir)) {
  console.error(`check-no-demo-code: ${distDir} doesn't exist. Run the build first.`);
  process.exit(1);
}

// Look for every marker in every built file and collect the hits.
const hits = filesIn(distDir).flatMap((file) => {
  const text = fs.readFileSync(file, "utf8");
  return MARKERS.filter((marker) => text.includes(marker)).map((marker) => `${path.relative(distDir, file)}: "${marker}"`);
});

if (hits.length > 0) {
  console.error("check-no-demo-code: guest-demo code found in the normal build:\n  " + hits.join("\n  "));
  process.exit(1);
}
console.log("check-no-demo-code: no guest-demo code in dist/.");
