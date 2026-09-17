import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { COUNTRIES } from "@familypassportmap/shared";
import { listPeople } from "../api/people";
import { getVisitedCountries, markCountryVisited, unmarkCountryVisited } from "../api/countries";
import { WorldMap, type WorldView } from "../components/WorldMap";
import { ContinentSelector } from "../components/ContinentSelector";
import { StateCounter } from "../components/StateCounter";

/**
 * The World Map page: pick a person and a continent, then click countries on the zoomed map
 * to mark or unmark them as visited. The World overview is view-only.
 */
export function WorldMapPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visitedCountryCodes, setVisitedCountryCodes] = useState<string[]>([]);
  const [view, setView] = useState<WorldView>("World");
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
    getVisitedCountries(selectedId)
      .then(setVisitedCountryCodes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load visited countries"));
  }, [selectedId]);

  const selectedPerson = people.find((p) => p.id === selectedId) ?? null;

  /**
   * Toggles a country's visited status for the currently selected person, updating the UI
   * immediately and rolling back if the server request fails.
   * @param countryCode - the ISO alpha-2 code of the clicked country.
   */
  async function handleToggleCountry(countryCode: string) {
    if (!selectedId) return;
    setError(null);
    const wasVisited = visitedCountryCodes.includes(countryCode);

    // Optimistic update: flip the country locally right away, before the request resolves.
    setVisitedCountryCodes((prev) =>
      wasVisited ? prev.filter((code) => code !== countryCode) : [...prev, countryCode],
    );

    try {
      if (wasVisited) {
        await unmarkCountryVisited(selectedId, countryCode);
      } else {
        await markCountryVisited(selectedId, countryCode);
      }
    } catch (err) {
      // The optimistic update was wrong — surface the error and re-fetch the true list.
      setError(err instanceof Error ? err.message : "Failed to update visited country");
      getVisitedCountries(selectedId).then(setVisitedCountryCodes).catch(() => {});
    }
  }

  // Still waiting on the initial people fetch.
  if (loading) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4">World Map</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Nothing to show without at least one person. */}
      {people.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No one added yet — add a person on the People page first.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
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
            <StateCounter count={visitedCountryCodes.length} total={COUNTRIES.length} label="countries" />
          </div>

          <div className="mb-4">
            <ContinentSelector value={view} onChange={setView} />
            {/* The overview is view-only, so tell people how to start marking countries. */}
            {view === "World" && (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Pick a continent to mark countries.</p>
            )}
          </div>

          {selectedPerson && (
            <div className="w-full max-w-4xl mx-auto">
              <WorldMap
                visitedCountryCodes={visitedCountryCodes}
                color={selectedPerson.colorHex}
                view={view}
                onToggleCountry={handleToggleCountry}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
