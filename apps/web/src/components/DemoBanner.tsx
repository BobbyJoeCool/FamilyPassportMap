import { REPO_URL } from "../demoMode";

/**
 * The guest demo's banner, at the top of every page. It can't be dismissed: a visitor should always
 * know that nothing they do is kept.
 */
export function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="Demo notice"
      className="px-4 py-2 text-center text-sm bg-amber-100 text-amber-950 border-b border-amber-300"
    >
      Demo: changes aren't saved, and reloading starts over.{" "}
      <a href={REPO_URL} className="underline font-medium" target="_blank" rel="noreferrer">
        See the code on GitHub
      </a>
    </div>
  );
}
