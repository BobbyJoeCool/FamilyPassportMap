// Route helpers for the two map sections (US and World), shared by the app shell and the
// section tab strip.

/** The two map sections, each with its own Map / Compare / List pages under `/<section>/`. */
export type Section = "us" | "world";

/** The sub-pages every section has, in tab order. */
export const SECTION_TABS = [
  { path: "map", label: "Map" },
  { path: "compare", label: "Compare" },
  { path: "list", label: "List" },
] as const;

/**
 * Works out which section and sub-tab a route belongs to.
 * @param pathname - the current location's path, e.g. "/world/compare".
 * @returns the section and tab path, or null for routes outside both sections (e.g. "/people").
 */
export function parseSectionPath(pathname: string): { section: Section; tab: string } | null {
  const match = /^\/(us|world)(?:\/([^/]+))?/.exec(pathname);
  // Not inside /us or /world — no section tabs apply.
  if (!match) return null;
  return { section: match[1] as Section, tab: match[2] ?? "map" };
}
