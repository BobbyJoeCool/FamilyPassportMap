import { Link, useLocation } from "react-router-dom";

/** The World section's sub-pages, in tab order. New World pages add an entry here. */
const WORLD_TABS = [
  { to: "/world/map", label: "Map" },
  { to: "/world/compare", label: "Compare" },
  { to: "/world/list", label: "List" },
] as const;

/**
 * The World section's internal tab strip, shown at the top of every World page. It keeps
 * the primary nav at a single "World" item instead of adding one top-level item per page.
 */
export function WorldTabs() {
  const location = useLocation();

  return (
    <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
      {/* One tab per World sub-page, underlined when it matches the current route. */}
      {WORLD_TABS.map((tab) => {
        const active = location.pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
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
