import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { US_STATES } from "@familypassportmap/shared";
import { listPeople } from "../api/people";
import { getAllVisits, type PersonVisits } from "../api/visits";
import { PersonAvatar } from "../components/PersonAvatar";

/**
 * The List page: every one of the 50 states, with each visited person's avatar shown
 * next to the states they've been to.
 */
export function ListPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [visits, setVisits] = useState<PersonVisits[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPeople(), getAllVisits()])
      .then(([loadedPeople, loadedVisits]) => {
        setPeople(loadedPeople);
        setVisits(loadedVisits);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Finds every person who has visited a given state.
   * @param stateCode - the USPS state code to look up.
   * @returns the people whose visited-state list includes that state.
   */
  function visitorsForState(stateCode: string): Person[] {
    // Reduce each person's full visits record down to just the ids of people who've
    // visited this particular state, then resolve those ids back to Person objects.
    const visitorIds = visits
      .filter((v) => v.stateCodes.includes(stateCode))
      .map((v) => v.personId);
    return people.filter((p) => visitorIds.includes(p.id));
  }

  // Still waiting on the initial fetch.
  if (loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;

  // No one to show states for yet.
  if (people.length === 0) {
    return (
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-6">List</h1>
        <p className="text-[var(--color-text-muted)]">No one added yet — add a person on the People page first.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">List</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* One row per US state, listing whichever people have visited it. */}
        {US_STATES.map((state) => {
          const visitors = visitorsForState(state.code);
          return (
            <div
              key={state.code}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]"
            >
              <span className="font-medium text-sm">{state.name}</span>
              <div className="flex gap-1 shrink-0">
                {visitors.map((person) => (
                  <PersonAvatar key={person.id} person={person} size={24} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
