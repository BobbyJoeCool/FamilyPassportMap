// The guest demo's build flag, read in the few places allowed to know about it: the sign-in gate,
// the account menu, the banner and the privacy text (docs/Phase-14-Guest-Demo.md). Pages and other
// components never check it. The fake API itself is installed in main.tsx.

/**
 * Whether this is the guest demo build (`VITE_DEMO=true`, see vite.config.ts). A function, not a
 * constant, so unit tests can switch it with `vi.stubEnv`.
 * @returns true in the demo build.
 */
export function isDemo(): boolean {
  return import.meta.env.VITE_DEMO === "true";
}

/**
 * The router's basename for a Vite base path: the demo on GitHub Pages lives under
 * "/FamilyPassportMap/", the real app at the site root.
 * @param baseUrl - Vite's `import.meta.env.BASE_URL` (always ends in "/").
 * @returns the base path without its trailing slash, or "/" for the site root.
 */
export function routerBasename(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** The project's GitHub repository, linked from the demo banner. */
export const REPO_URL = "https://github.com/BobbyJoeCool/FamilyPassportMap";
