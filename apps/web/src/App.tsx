import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PeoplePage } from "./pages/PeoplePage";
import { MapPage } from "./pages/MapPage";
import { ComparePage } from "./pages/ComparePage";
import { ListPage } from "./pages/ListPage";

// The World pages are lazy-loaded so the world topology (world-atlas) ships in its own chunk
// instead of weighing down the US pages. Each module exports a named component, so it's mapped
// to the `default` export React.lazy expects.
const WorldMapPage = lazy(() => import("./pages/WorldMapPage").then((m) => ({ default: m.WorldMapPage })));
const WorldComparePage = lazy(() =>
  import("./pages/WorldComparePage").then((m) => ({ default: m.WorldComparePage })),
);
const WorldListPage = lazy(() => import("./pages/WorldListPage").then((m) => ({ default: m.WorldListPage })));

const NAV_ITEMS = [
  { to: "/people", label: "People", icon: "👤" },
  { to: "/map", label: "Map", icon: "🗺️" },
  { to: "/compare", label: "Compare", icon: "⚖️" },
  { to: "/list", label: "List", icon: "📋" },
  { to: "/world", label: "World", icon: "🌍" },
] as const;

/**
 * A single navigation link, styled as active/inactive based on the current route.
 * @param to - the route path this link navigates to.
 * @param label - the link's visible text.
 * @param icon - the emoji shown before the label.
 * @param active - whether this link corresponds to the currently active route.
 */
function NavLink({ to, label, icon, active }: { to: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
        ${active
          ? "bg-[var(--color-primary)] text-white"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-bg-card)]"
        }`}
    >
      <span className="text-base">{icon}</span>
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden text-xs">{label}</span>
    </Link>
  );
}

/**
 * Decides whether a nav item should be highlighted for the current route. The World item
 * owns a whole section (/world/map, /world/compare, /world/list), so it matches
 * by prefix; every other item matches its exact path.
 * @param to - the nav item's route.
 * @param pathname - the current location's path.
 * @returns true if the nav item should render as active.
 */
function isNavActive(to: string, pathname: string): boolean {
  // Section items match any route inside the section; page items match only themselves.
  return to === "/world" ? pathname.startsWith("/world") : pathname === to;
}

/**
 * The app shell: top nav (desktop) / bottom tab bar (mobile) plus the routed page content.
 */
function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <span className="font-bold text-lg text-[var(--color-text-heading)] mr-4">🗺️ FamilyPassportMap</span>
        {/* One NavLink per top-level page, active state driven by the current route. */}
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} {...item} active={isNavActive(item.to, location.pathname)} />
        ))}
      </nav>

      {/* Page content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* Fallback shown while a lazy World page chunk downloads. */}
        <Suspense fallback={<p className="text-[var(--color-text-muted)]">Loading…</p>}>
          <Routes>
            {/* Default route: no page owns "/", so redirect straight to Map. */}
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/list" element={<ListPage />} />
            {/* The World section has no page of its own at /world — land on its Map tab. */}
            <Route path="/world" element={<Navigate to="/world/map" replace />} />
            <Route path="/world/map" element={<WorldMapPage />} />
            <Route path="/world/compare" element={<WorldComparePage />} />
            <Route path="/world/list" element={<WorldListPage />} />
          </Routes>
        </Suspense>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] z-50">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors
              ${isNavActive(item.to, location.pathname)
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)]"
              }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default App;
