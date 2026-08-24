import { handleResponse } from "./http";

/** One person's full set of visited state codes, as returned by the bulk visits endpoint. */
export interface PersonVisits {
  personId: string;
  stateCodes: string[];
}

/** Fetches every person's visited states in one call (used by Compare/List/People). */
export function getAllVisits(): Promise<PersonVisits[]> {
  return fetch("/api/visits").then((res) => handleResponse<PersonVisits[]>(res));
}

/** Fetches one person's visited state codes. */
export function getVisitedStates(personId: string): Promise<string[]> {
  return fetch(`/api/people/${personId}/visits`).then((res) => handleResponse<string[]>(res));
}

/** Marks a state as visited for a person. Idempotent — safe to call if already marked. */
export function markVisited(personId: string, stateCode: string): Promise<void> {
  return fetch(`/api/people/${personId}/visits/${stateCode}`, { method: "PUT" }).then((res) =>
    handleResponse<void>(res),
  );
}

/** Unmarks a state as visited for a person. */
export function unmarkVisited(personId: string, stateCode: string): Promise<void> {
  return fetch(`/api/people/${personId}/visits/${stateCode}`, { method: "DELETE" }).then((res) =>
    handleResponse<void>(res),
  );
}
