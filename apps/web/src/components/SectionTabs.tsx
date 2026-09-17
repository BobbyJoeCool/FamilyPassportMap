import { Link, useLocation } from "react-router-dom";
import { SECTION_TABS, type Section } from "../sections";

/**
 * The Map / Compare / List tab strip shown under the top menu on every US and World page, so
 * both sections share one sub-navigation instead of the US pages living in the top menu.
 * @param section - which section's pages the tabs link to.
 */
export function SectionTabs({ section }: { section: Section }) {
  const location = useLocation();

  return (
    <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
      {/* One tab per sub-page, underlined when it matches the current route. */}
      {SECTION_TABS.map((tab) => {
        const to = `/${section}/${tab.path}`;
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors
              ${active
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)]"
              }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
