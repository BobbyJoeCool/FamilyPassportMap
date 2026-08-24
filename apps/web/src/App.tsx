import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PeoplePage } from "./pages/PeoplePage";
import { MapPage } from "./pages/MapPage";
import { ComparePage } from "./pages/ComparePage";
import { ListPage } from "./pages/ListPage";

const NAV_ITEMS = [
  { to: "/people", label: "People", icon: "👤" },
  { to: "/map", label: "Map", icon: "🗺️" },
  { to: "/compare", label: "Compare", icon: "⚖️" },
  { to: "/list", label: "List", icon: "📋" },
] as const;

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

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <span className="font-bold text-lg text-[var(--color-text-heading)] mr-4">🗺️ FamilyPassportMap</span>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} {...item} active={location.pathname === item.to} />
        ))}
      </nav>

      {/* Page content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:px-6 md:py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/list" element={<ListPage />} />
        </Routes>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] z-50">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors
              ${location.pathname === item.to
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
