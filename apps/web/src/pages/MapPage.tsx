import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { listPeople } from "../api/people";
import { getVisitedStates, markVisited, unmarkVisited } from "../api/visits";
import { UsMap } from "../components/UsMap";

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
    // No selection means either "still loading people" or "no people at all" — in both
    // cases the map isn't rendered below, so there's nothing to fetch or reset here.
    if (!selectedId) return;
    getVisitedStates(selectedId)
      .then(setVisitedStateCodes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load visited states"));
  }, [selectedId]);

  const selectedPerson = people.find((p) => p.id === selectedId) ?? null;

  async function handleToggleState(stateCode: string) {
    if (!selectedId) return;
    setError(null);
    const wasVisited = visitedStateCodes.includes(stateCode);

    // Optimistic update, reconciled by refetching if the request fails.
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
      setError(err instanceof Error ? err.message : "Failed to update visited state");
      getVisitedStates(selectedId).then(setVisitedStateCodes).catch(() => {});
    }
  }

  if (loading) {
    return <p>Loading…</p>;
  }

  if (people.length === 0) {
    return <p>No one added yet — add a person on the People page first.</p>;
  }

  return (
    <div>
      <h1>Map</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <label>
        Person
        <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>

      {selectedPerson && (
        <UsMap
          visitedStateCodes={visitedStateCodes}
          color={selectedPerson.colorHex}
          onToggleState={handleToggleState}
        />
      )}
    </div>
  );
}
