import { handleResponse } from "./http";

export interface PersonVisits {
  personId: string;
  stateCodes: string[];
}

export function getAllVisits(): Promise<PersonVisits[]> {
  return fetch("/api/visits").then((res) => handleResponse<PersonVisits[]>(res));
}

export function getVisitedStates(personId: string): Promise<string[]> {
  return fetch(`/api/people/${personId}/visits`).then((res) => handleResponse<string[]>(res));
}

export function markVisited(personId: string, stateCode: string): Promise<void> {
  return fetch(`/api/people/${personId}/visits/${stateCode}`, { method: "PUT" }).then((res) =>
    handleResponse<void>(res),
  );
}

export function unmarkVisited(personId: string, stateCode: string): Promise<void> {
  return fetch(`/api/people/${personId}/visits/${stateCode}`, { method: "DELETE" }).then((res) =>
    handleResponse<void>(res),
  );
}
