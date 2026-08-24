import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { listPeople } from "../api/people";
import { getVisitedStates, markVisited, unmarkVisited } from "../api/visits";
import { UsMap } from "../components/UsMap";
import { StateCounter } from "../components/StateCounter";

/**
 * The Map page: pick a person, then click states on an interactive US map to mark or
 * unmark them as visited.
 */
export function MapPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visitedStateCodes, setVisitedStateCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPeople()
      .then((loaded) => {
        setPeople(loaded);
        setSelectedId(loaded[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load people"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // No one selected yet (e.g. still loading, or no people exist) — nothing to fetch.
    if (!selectedId) return;
    getVisitedStates(selectedId)
      .then(setVisitedStateCodes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load visited states"));
  }, [selectedId]);

  const selectedPerson = people.find((p) => p.id === selectedId) ?? null;

  /**
   * Toggles a state's visited status for the currently selected person, updating the
   * UI immediately and rolling back if the server request fails.
   * @param stateCode - the USPS code of the clicked state.
   */
  async function handleToggleState(stateCode: string) {
    if (!selectedId) return;
    setError(null);
    const wasVisited = visitedStateCodes.includes(stateCode);

    // Optimistic update: flip the state locally right away, before the request resolves.
    setVisitedStateCodes((prev) =>
      wasVisited ? prev.filter((code) => code !== stateCode) : [...prev, stateCode],
    );

    try {
      if (wasVisited) {
        await unmarkVisited(selectedId, stateCode);
      } else {
        await markVisited(selectedId, stateCode);
      }
    } catch (err) {
      // The optimistic update was wrong — surface the error and re-fetch the true state.
      setError(err instanceof Error ? err.message : "Failed to update visited state");
      getVisitedStates(selectedId).then(setVisitedStateCodes).catch(() => {});
    }
  }

  // Still waiting on the initial people fetch.
  if (loading) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }

  // Nothing to show without at least one person.
  if (people.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No one added yet — add a person on the People page first.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Map</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium">
          Person
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="ml-2 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-base"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <StateCounter count={visitedStateCodes.length} />
      </div>

      {selectedPerson && (
        <div className="w-full max-w-4xl mx-auto">
          <UsMap
            visitedStateCodes={visitedStateCodes}
            color={selectedPerson.colorHex}
            onToggleState={handleToggleState}
          />
        </div>
      )}
    </div>
  );
}
