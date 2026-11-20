import { describe, it, expect, vi } from "vitest";
import { jsonResponse, makePerson, mockFetch } from "../test/api";

vi.mock("../navigation", () => ({ loadPage: vi.fn() }));
const { loadPage } = await import("../navigation");
const { createPrimaryPerson, deleteAccount, fetchCurrentUser, microsoftSignInUrl, signOut } = await import("./auth");

const me = {
  user: { id: "u1", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
  primaryPersonId: "p1",
};

describe("fetchCurrentUser", () => {
  it("returns who is signed in", async () => {
    mockFetch({ "GET /api/me": me });
    await expect(fetchCurrentUser()).resolves.toEqual(me);
  });

  it("returns null when signed out, without redirecting", async () => {
    mockFetch({ "GET /api/me": jsonResponse(401, { error: "Not signed in" }) });
    await expect(fetchCurrentUser()).resolves.toBeNull();
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("throws when the server fails", async () => {
    mockFetch({ "GET /api/me": jsonResponse(500) });
    await expect(fetchCurrentUser()).rejects.toThrow("Request failed with status 500");
  });
});

describe("createPrimaryPerson", () => {
  it("POSTs the name and color as JSON", async () => {
    const { calls } = mockFetch({ "POST /api/me/primary-person": jsonResponse(201, makePerson({ isPrimary: true })) });
    await expect(createPrimaryPerson({ name: "Alice", colorHex: "#3366cc" })).resolves.toMatchObject({ isPrimary: true });
    expect(calls[0]).toEqual({ method: "POST", url: "/api/me/primary-person", body: { name: "Alice", colorHex: "#3366cc" } });
  });

  it("treats 409 (already done in another tab) as null, not an error", async () => {
    mockFetch({ "POST /api/me/primary-person": jsonResponse(409, { error: "You already have a Primary Person." }) });
    await expect(createPrimaryPerson({ name: "Alice", colorHex: "#3366cc" })).resolves.toBeNull();
  });
});

describe("signOut", () => {
  it("POSTs to /api/auth/signout", async () => {
    const { calls } = mockFetch({ "POST /api/auth/signout": jsonResponse(204) });
    await signOut();
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/auth/signout" });
  });

  it("throws when the server refuses, so the caller doesn't pretend", async () => {
    mockFetch({ "POST /api/auth/signout": jsonResponse(500) });
    await expect(signOut()).rejects.toThrow("Sign out failed with status 500");
  });
});

describe("deleteAccount", () => {
  it("sends DELETE /api/me", async () => {
    const { calls } = mockFetch({ "DELETE /api/me": jsonResponse(204) });
    await deleteAccount();
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "/api/me" });
  });

  it("sends an expired session to sign-in", async () => {
    mockFetch({ "DELETE /api/me": jsonResponse(401) });
    await expect(deleteAccount()).rejects.toThrow("Not signed in");
    expect(loadPage).toHaveBeenCalledWith(expect.stringMatching(/^\/signin\?returnTo=/));
  });
});

describe("microsoftSignInUrl", () => {
  it("encodes the return path into the sign-in start URL", () => {
    expect(microsoftSignInUrl("/world/list?x=1&y=2")).toBe("/api/auth/microsoft?returnTo=%2Fworld%2Flist%3Fx%3D1%26y%3D2");
  });
});
