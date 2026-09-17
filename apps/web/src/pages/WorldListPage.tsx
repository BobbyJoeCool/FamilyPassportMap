import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { CONTINENTS, countriesByContinent } from "@familypassportmap/shared";
import { listPeople } from "../api/people";
import { getAllCountries, type PersonCountries } from "../api/countries";
import { PersonAvatar } from "../components/PersonAvatar";
import { WorldTabs } from "../components/WorldTabs";

/**
 * The World List page: all 195 countries, grouped into one section per continent, with each
 * visitor's avatar shown next to the countries they've been to.
 */
export function WorldListPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [countries, setCountries] = useState<PersonCountries[]>([]);
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
   * Finds every person who has visited a given country.
   * @param countryCode - the ISO alpha-2 code to look up.
   * @returns the people whose visited-country list includes that country.
   */
  function visitorsForCountry(countryCode: string): Person[] {
    // Reduce each person's record down to just the ids of people who've visited this
    // country, then resolve those ids back to Person objects (keeping People-page order).
    const visitorIds = countries.filter((c) => c.countryCodes.includes(countryCode)).map((c) => c.personId);
    return people.filter((p) => visitorIds.includes(p.id));
  }

  // Still waiting on the initial fetch.
  if (loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;

  return (
    <div>
      <WorldTabs />
      <h1 className="text-2xl md:text-3xl font-bold mb-6">World List</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* No one to show countries for yet. */}
      {people.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No one added yet — add a person on the People page first.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* One section per continent, in CONTINENTS order. */}
          {CONTINENTS.map((continent) => {
            const continentCountries = countriesByContinent(continent);
            return (
              <section key={continent}>
                <h2 className="text-lg font-semibold mb-3">
                  {continent}
                  <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                    · {continentCountries.length} countries
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {/* One row per country in this continent (already alphabetical), with its visitors. */}
                  {continentCountries.map((country) => {
                    const visitors = visitorsForCountry(country.code);
                    return (
                      <div
                        key={country.code}
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]"
                      >
                        <span className="font-medium text-sm">{country.name}</span>
                        <div className="flex gap-1 shrink-0">
                          {visitors.map((person) => (
                            <PersonAvatar key={person.id} person={person} size={24} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
