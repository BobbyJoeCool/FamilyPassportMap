import type { CreatePersonInput, Person, UpdatePersonInput } from "@familypassportmap/shared";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function listPeople(): Promise<Person[]> {
  return fetch("/api/people").then((res) => handleResponse<Person[]>(res));
}

export function createPerson(input: CreatePersonInput): Promise<Person> {
  return fetch("/api/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => handleResponse<Person>(res));
}

export function updatePerson(id: string, input: UpdatePersonInput): Promise<Person> {
  return fetch(`/api/people/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => handleResponse<Person>(res));
}

export function deletePerson(id: string): Promise<void> {
  return fetch(`/api/people/${id}`, { method: "DELETE" }).then((res) => handleResponse<void>(res));
}

export function uploadPersonPhoto(id: string, file: File): Promise<Person> {
  const formData = new FormData();
  formData.append("photo", file);
  return fetch(`/api/people/${id}/photo`, { method: "POST", body: formData }).then((res) =>
    handleResponse<Person>(res),
  );
}
