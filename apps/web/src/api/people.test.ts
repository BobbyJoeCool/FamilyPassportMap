import { describe, it, expect } from "vitest";
import { jsonResponse, makePerson, mockFetch } from "../test/api";
import {
  claimPerson,
  createPerson,
  deletePerson,
  getPeopleAllowance,
  listPeople,
  updatePerson,
  uploadPersonPhoto,
} from "./people";

describe("people API", () => {
  it("lists People with GET /api/people", async () => {
    const people = [makePerson()];
    const { calls } = mockFetch({ "GET /api/people": people });
    await expect(listPeople()).resolves.toEqual(people);
    expect(calls).toEqual([{ method: "GET", url: "/api/people", body: undefined }]);
  });

  it("reads the allowance with GET /api/people/allowance", async () => {
    mockFetch({ "GET /api/people/allowance": { owned: 3, max: 10 } });
    await expect(getPeopleAllowance()).resolves.toEqual({ owned: 3, max: 10 });
  });

  it("creates with a JSON POST", async () => {
    const { calls, fetchMock } = mockFetch({ "POST /api/people": jsonResponse(201, makePerson({ name: "Sam" })) });
    await expect(createPerson({ name: "Sam", colorHex: "#112233" })).resolves.toMatchObject({ name: "Sam" });
    expect(calls[0]).toEqual({ method: "POST", url: "/api/people", body: { name: "Sam", colorHex: "#112233" } });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("surfaces the cap error from a 409", async () => {
    mockFetch({ "POST /api/people": jsonResponse(409, { error: "You can have up to 10 people, including yourself." }) });
    await expect(createPerson({ name: "Sam", colorHex: "#112233" })).rejects.toThrow("up to 10 people");
  });

  it("renames with a JSON PATCH to the Person's path", async () => {
    const { calls } = mockFetch({ "PATCH /api/people/p1": makePerson({ name: "Ally" }) });
    await updatePerson("p1", { name: "Ally" });
    expect(calls[0]).toEqual({ method: "PATCH", url: "/api/people/p1", body: { name: "Ally" } });
  });

  it("deletes with DELETE and resolves on 204", async () => {
    const { calls } = mockFetch({ "DELETE /api/people/p1": jsonResponse(204) });
    await expect(deletePerson("p1")).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "/api/people/p1" });
  });

  it("uploads the photo as multipart form data under 'photo'", async () => {
    const { calls } = mockFetch({ "POST /api/people/p1/photo": makePerson({ profilePicturePath: "uploads/a.png" }) });
    const file = new File(["png"], "me.png", { type: "image/png" });
    await uploadPersonPhoto("p1", file);
    expect(calls[0].url).toBe("/api/people/p1/photo");
    expect(calls[0].body).toBeInstanceOf(FormData);
    expect((calls[0].body as FormData).get("photo")).toBe(file);
  });

  it("claims with POST /api/people/:id/claim", async () => {
    const { calls } = mockFetch({ "POST /api/people/p2/claim": makePerson({ id: "p2", isPrimary: true }) });
    await expect(claimPerson("p2")).resolves.toMatchObject({ id: "p2", isPrimary: true });
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/people/p2/claim" });
  });
});
