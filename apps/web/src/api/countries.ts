import { handleResponse } from "./http";

// Mirrors api/visits.ts for countries. Country codes are uppercase ISO 3166-1 alpha-2.

/** One person's full set of visited country codes, as returned by the bulk countries endpoint. */
export interface PersonCountries {
  personId: string;
  countryCodes: string[];
}

/** Fetches every person's visited countries in one call (used by World Compare/List/People). */
export function getAllCountries(): Promise<PersonCountries[]> {
  return fetch("/api/countries").then((res) => handleResponse<PersonCountries[]>(res));
}

/** Fetches one person's visited country codes. */
export function getVisitedCountries(personId: string): Promise<string[]> {
  return fetch(`/api/people/${personId}/countries`).then((res) => handleResponse<string[]>(res));
}

/** Marks a country as visited for a person. Idempotent — safe to call if already marked. */
export function markCountryVisited(personId: string, countryCode: string): Promise<void> {
  return fetch(`/api/people/${personId}/countries/${countryCode}`, { method: "PUT" }).then((res) =>
    handleResponse<void>(res),
  );
}

/** Unmarks a country as visited for a person. */
export function unmarkCountryVisited(personId: string, countryCode: string): Promise<void> {
  return fetch(`/api/people/${personId}/countries/${countryCode}`, { method: "DELETE" }).then((res) =>
    handleResponse<void>(res),
  );
}
