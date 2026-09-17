import { US_STATES } from "@familypassportmap/shared";

/**
 * Renders a small "n/total label" badge. Reused anywhere a person's visited tally appears:
 * People (per row), Map and World Map (next to the person selector), and Compare and World
 * Compare (above each person's map). Defaults to the US-states variant; the World pages pass
 * `total={COUNTRIES.length}` and `label="countries"`.
 * @param count - the number of places visited.
 * @param total - the denominator to show (defaults to all 50 US states).
 * @param label - the unit shown after the fraction (defaults to "states").
 */
export function StateCounter({
  count,
  total = US_STATES.length,
  label = "states",
}: {
  count: number;
  total?: number;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap">
      {count}/{total} {label}
    </span>
  );
}
