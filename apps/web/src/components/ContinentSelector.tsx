import { CONTINENTS } from "@familypassportmap/shared";
import type { WorldView } from "./WorldMap";

/** Every selectable view, in display order: the World overview first, then the 6 continents. */
const VIEW_OPTIONS: WorldView[] = ["World", ...CONTINENTS];

/**
 * A row of pill buttons for choosing which part of the world map to show — the World
 * overview or one continent. Controlled: the parent owns the selected view, so World Map
 * and World Compare can share the same component.
 * @param value - the currently selected view.
 * @param onChange - called with the newly chosen view when a button is clicked.
 */
export function ContinentSelector({ value, onChange }: { value: WorldView; onChange: (view: WorldView) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a continent">
      {/* One button per view; the active one is highlighted in the primary color. */}
      {VIEW_OPTIONS.map((view) => {
        const active = view === value;
        return (
          <button
            key={view}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(view)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${active
                ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                : "bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
              }`}
          >
            {view}
          </button>
        );
      })}
    </div>
  );
}
