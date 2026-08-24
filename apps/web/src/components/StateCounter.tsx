import { US_STATES } from "@familypassportmap/shared";

/**
 * Renders a small "n/total states" badge. Reused anywhere a person's visited-state tally
 * appears: People (per row), Map (next to the person selector), and Compare (above each
 * person's map).
 * @param count - the number of states visited.
 * @param total - the denominator to show (defaults to all 50 US states).
 */
export function StateCounter({ count, total = US_STATES.length }: { count: number; total?: number }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap">
      {count}/{total} states
    </span>
  );
}
