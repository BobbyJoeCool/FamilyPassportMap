import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { listPeople } from "../api/people";
import { getAllVisits, type PersonVisits } from "../api/visits";
import { UsMap } from "../components/UsMap";

export function ComparePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [visits, setVisits] = useState<PersonVisits[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  function togglePerson(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function visitsForPerson(personId: string): string[] {
    return visits.find((v) => v.personId === personId)?.stateCodes ?? [];
  }

  if (loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;

  if (people.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No one added yet — add a person on the People page first.</p>;
  }

  const selectedPeople = people.filter((p) => selectedIds.has(p.id));

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Compare</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

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

      {selectedPeople.length === 0 && (
        <p className="text-[var(--color-text-muted)]">Select people above to compare their maps.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {selectedPeople.map((person) => (
          <div key={person.id}>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block shrink-0"
                style={{ backgroundColor: person.colorHex }}
              />
              {person.name}
            </h2>
            <UsMap visitedStateCodes={visitsForPerson(person.id)} color={person.colorHex} />
          </div>
        ))}
      </div>
    </div>
  );
}
