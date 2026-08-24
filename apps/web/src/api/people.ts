import type { CreatePersonInput, Person, UpdatePersonInput } from "@familypassportmap/shared";
import { handleResponse } from "./http";

/** Fetches every person. */
export function listPeople(): Promise<Person[]> {
  return fetch("/api/people").then((res) => handleResponse<Person[]>(res));
}

/** Creates a new person with the given name and color. */
export function createPerson(input: CreatePersonInput): Promise<Person> {
  return fetch("/api/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => handleResponse<Person>(res));
}

/** Partially updates a person's name and/or color. */
export function updatePerson(id: string, input: UpdatePersonInput): Promise<Person> {
  return fetch(`/api/people/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => handleResponse<Person>(res));
}

/** Deletes a person (their visited states cascade-delete with them on the server). */
export function deletePerson(id: string): Promise<void> {
  return fetch(`/api/people/${id}`, { method: "DELETE" }).then((res) => handleResponse<void>(res));
}

/** Uploads/replaces a person's profile picture. */
export function uploadPersonPhoto(id: string, file: File): Promise<Person> {
  const formData = new FormData();
  formData.append("photo", file);
  return fetch(`/api/people/${id}/photo`, { method: "POST", body: formData }).then((res) =>
    handleResponse<Person>(res),
  );
}
