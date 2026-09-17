import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { COUNTRIES } from "@familypassportmap/shared";
import { listPeople } from "../api/people";
import { getAllCountries, type PersonCountries } from "../api/countries";
import { WorldMap, type WorldView } from "../components/WorldMap";
import { ContinentSelector } from "../components/ContinentSelector";
import { StateCounter } from "../components/StateCounter";

/**
 * The World Compare page: pick two or more people and see their visited-country maps side by
 * side, all framed on the same continent (or the whole world) via one shared selector.
 */
export function WorldComparePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [countries, setCountries] = useState<PersonCountries[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<WorldView>("World");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPeople(), getAllCountries()])
      .then(([loadedPeople, loadedCountries]) => {
        setPeople(loadedPeople);
        setCountries(loadedCountries);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Adds or removes a person from the set of people currently being compared.
   * @param id - the id of the person whose checkbox was toggled.
   */
  function togglePerson(id: string) {
    setSelectedIds((prev) => {
      // Copy rather than mutate the previous Set, so React sees a new reference and re-renders.
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /**
   * Looks up a person's visited country codes.
   * @param personId - the person's id.
   * @returns their visited country codes, or an empty array if they have none on record.
   */
  function countriesForPerson(personId: string): string[] {
    return countries.find((c) => c.personId === personId)?.countryCodes ?? [];
  }

  // Still waiting on the initial fetch.
  if (loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;

  const selectedPeople = people.filter((p) => selectedIds.has(p.id));

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4">World Compare</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Nothing to compare without at least one person. */}
      {people.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No one added yet — add a person on the People page first.</p>
      ) : (
        <>
          <fieldset className="mb-6 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <legend className="text-sm font-medium px-2">Select people to compare</legend>
            <div className="flex flex-wrap gap-4 mt-2">
              {people.map((person) => (
                <label key={person.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(person.id)}
                    onChange={() => togglePerson(person.id)}
                    className="rounded"
                  />
                  <span
                    className="w-3 h-3 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: person.colorHex }}
                  />
                  {person.name}
                </label>
              ))}
            </div>
          </fieldset>

          {/* No cards yet: prompt for a selection instead of showing a selector with nothing to zoom. */}
          {selectedPeople.length === 0 ? (
            <p className="text-[var(--color-text-muted)]">Select people above to compare their maps.</p>
          ) : (
            <div className="mb-4">
              <ContinentSelector value={view} onChange={setView} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* One read-only map per selected person, all framed on the shared view. */}
            {selectedPeople.map((person) => (
              <div key={person.id}>
                <h2 className="text-lg font-semibold mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: person.colorHex }}
                  />
                  {person.name}
                  <StateCounter
                    count={countriesForPerson(person.id).length}
                    total={COUNTRIES.length}
                    label="countries"
                  />
                </h2>
                <WorldMap visitedCountryCodes={countriesForPerson(person.id)} color={person.colorHex} view={view} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
