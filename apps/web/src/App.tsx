import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PeoplePage } from "./pages/PeoplePage";
import { MapPage } from "./pages/MapPage";
import { ComparePage } from "./pages/ComparePage";
import { ListPage } from "./pages/ListPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { UserMenu } from "./components/UserMenu";
import { SectionTabs } from "./components/SectionTabs";
import { SignInPage } from "./pages/SignInPage";
import { WelcomePage } from "./pages/WelcomePage";
import { signInPath } from "./auth/signInPath";
import { useCurrentUser } from "./auth/useCurrentUser";
import { DEFAULT_LANDING_PATH, safeReturnTo, type CurrentUserResponse } from "@familypassportmap/shared";
import { parseSectionPath } from "./sections";

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
  { to: "/us", label: "US", icon: "🗺️" },
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
 * Decides whether a nav item should be highlighted for the current route. US and World each
 * own a whole section (/us/map, /world/list, …), so they match by prefix; People matches exactly.
 * @param to - the nav item's route.
 * @param pathname - the current location's path.
 * @returns true if the nav item should render as active.
 */
function isNavActive(to: string, pathname: string): boolean {
  // Section items match any route inside the section; the People page matches only itself.
  return to === "/people" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Resolves where a nav item should actually link. Switching between US and World keeps the
 * current sub-tab (US Compare → World Compare); coming from outside both sections lands on Map.
 * @param to - the nav item's base route.
 * @param pathname - the current location's path.
 * @returns the concrete path to link to.
 */
function navTarget(to: string, pathname: string): string {
  // People has no sub-tabs — always link straight to it.
  if (to === "/people") return to;
  return `${to}/${parseSectionPath(pathname)?.tab ?? "map"}`;
}

/**
 * The signed-in app shell: top nav (desktop) / bottom tab bar (mobile) plus the routed page
 * content, with the user menu in the header.
 * @param currentUser - who is signed in.
 */
function AppShell({ currentUser }: { currentUser: CurrentUserResponse }) {
  const location = useLocation();
  const section = parseSectionPath(location.pathname)?.section;

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <span className="font-bold text-lg text-[var(--color-text-heading)] mr-4">🗺️ FamilyPassportMap</span>
        {/* One NavLink per top-level item (People, US, World), active state driven by the current route. */}
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            {...item}
            to={navTarget(item.to, location.pathname)}
            active={isNavActive(item.to, location.pathname)}
          />
        ))}
        <div className="ml-auto">
          <UserMenu user={currentUser.user} />
        </div>
      </nav>

      {/* Mobile top bar: the bottom tab bar has no room for the user menu. */}
      <header className="md:hidden flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <span className="font-bold text-[var(--color-text-heading)]">🗺️ FamilyPassportMap</span>
        <UserMenu user={currentUser.user} />
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* US and World pages share one Map / Compare / List tab strip, shown outside the
            Suspense boundary so it stays put while a lazy World page loads. */}
        {section && <SectionTabs section={section} />}

        {/* Fallback shown while a lazy World page chunk downloads. */}
        <Suspense fallback={<p className="text-[var(--color-text-muted)]">Loading…</p>}>
          <Routes>
            {/* Default route: no page owns "/", so redirect straight to the US map. */}
            <Route path="/" element={<Navigate to="/us/map" replace />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            {/* Neither section has a page of its own at its root — land on its Map tab. */}
            <Route path="/us" element={<Navigate to="/us/map" replace />} />
            <Route path="/us/map" element={<MapPage />} />
            <Route path="/us/compare" element={<ComparePage />} />
            <Route path="/us/list" element={<ListPage />} />
            <Route path="/world" element={<Navigate to="/world/map" replace />} />
            <Route path="/world/map" element={<WorldMapPage />} />
            <Route path="/world/compare" element={<WorldComparePage />} />
            <Route path="/world/list" element={<WorldListPage />} />
            {/* Pre-v2.2 US paths (bookmarks, links) redirect to their new /us/ homes. */}
            <Route path="/map" element={<Navigate to="/us/map" replace />} />
            <Route path="/compare" element={<Navigate to="/us/compare" replace />} />
            <Route path="/list" element={<Navigate to="/us/list" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] z-50">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={navTarget(item.to, location.pathname)}
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

/**
 * The sign-in gate. Finds out who's signed in, then shows the sign-in page, the public privacy
 * page, or the full app. Every other signed-out visit is sent to /signin, remembering where it was
 * headed so sign-in can come back to it.
 */
function App() {
  const location = useLocation();
  const currentUserState = useCurrentUser();

  // The sign-in page never shows app chrome. Someone already signed in skips past it.
  if (location.pathname === "/signin") {
    if (currentUserState.status === "ready") {
      // Same rule the server applies: only paths inside this app.
      return <Navigate to={safeReturnTo(new URLSearchParams(location.search).get("returnTo"))} replace />;
    }
    return <SignInPage />;
  }

  if (currentUserState.status === "ready") {
    const { currentUser } = currentUserState;
    // No Primary Person yet: the welcome step comes before anything else (the privacy page
    // stays reachable below). Leaving and coming back lands here again until it's done.
    if (currentUser.primaryPersonId === null && location.pathname !== "/privacy") {
      // Always show the welcome step at its own address.
      if (location.pathname !== "/welcome") return <Navigate to="/welcome" replace />;
      return <WelcomePage suggestedName={currentUser.user.displayName} />;
    }
    // Welcome already done: /welcome has nothing left to do.
    if (location.pathname === "/welcome") return <Navigate to={DEFAULT_LANDING_PATH} replace />;
    // Signed in: the whole app, including /privacy inside the normal shell.
    return <AppShell currentUser={currentUser} />;
  }

  // The privacy page is public: it renders on its own while signed out (or still checking).
  if (location.pathname === "/privacy") {
    return (
      <main className="max-w-6xl w-full mx-auto px-4 py-6 md:px-6 md:py-8">
        <PrivacyPage />
      </main>
    );
  }

  // Still finding out who's signed in.
  if (currentUserState.status === "loading") {
    return <p className="p-6 text-[var(--color-text-muted)]">Loading…</p>;
  }

  // The server couldn't be reached — don't pretend the visitor is signed out.
  if (currentUserState.status === "error") {
    return <p className="p-6 text-[var(--color-danger)]">Couldn't reach the server: {currentUserState.message}</p>;
  }

  // Signed out on a protected page: go sign in, then come back here.
  return <Navigate to={signInPath(location.pathname + location.search)} replace />;
}

export default App;
