import { describe, it, expect, vi } from "vitest";
import { jsonResponse, makePerson, mockFetch } from "../test/api";

vi.mock("../navigation", () => ({ loadPage: vi.fn() }));
const { loadPage } = await import("../navigation");
const {
  createPrimaryPerson,
  deleteAccount,
  fetchAvailableSignInMethods,
  fetchCurrentUser,
  listSignInMethods,
  providerSignInUrl,
  removeSignInMethod,
  renamePasskey,
  signOut,
} = await import("./auth");

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

describe("providerSignInUrl", () => {
  it("encodes the return path into a provider's sign-in start URL", () => {
    expect(providerSignInUrl("microsoft", "/world/list?x=1&y=2")).toBe("/api/auth/microsoft?returnTo=%2Fworld%2Flist%3Fx%3D1%26y%3D2");
    expect(providerSignInUrl("github", "/us/map")).toBe("/api/auth/github?returnTo=%2Fus%2Fmap");
  });

  it("marks an add to the signed-in account", () => {
    expect(providerSignInUrl("google", "/account/sign-in", "add")).toBe("/api/auth/google?returnTo=%2Faccount%2Fsign-in&intent=add");
  });
});

describe("sign-in method calls", () => {
  it("reads which sign-in methods the server offers", async () => {
    mockFetch({ "GET /api/auth/methods": { providers: ["google"], passkeys: true } });
    await expect(fetchAvailableSignInMethods()).resolves.toEqual({ providers: ["google"], passkeys: true });
  });

  it("lists, removes and renames sign-in methods", async () => {
    const method = { id: "m1", kind: "passkey", label: "Phone", createdAt: "2026-01-01T00:00:00.000Z", lastUsedAt: "2026-01-01T00:00:00.000Z" };
    const { calls } = mockFetch({
      "GET /api/me/sign-in-methods": { methods: [method] },
      "DELETE /api/me/sign-in-methods/m1": jsonResponse(204),
      "PATCH /api/me/passkeys/m1": { ...method, label: "Tablet" },
    });
    await expect(listSignInMethods()).resolves.toEqual([method]);
    await removeSignInMethod("m1");
    await expect(renamePasskey("m1", "Tablet")).resolves.toMatchObject({ label: "Tablet" });
    expect(calls[2].body).toEqual({ name: "Tablet" });
  });

  it("passes on the last-method refusal", async () => {
    mockFetch({ "DELETE /api/me/sign-in-methods/m1": jsonResponse(409, { error: "This is your only way to sign in" }) });
    await expect(removeSignInMethod("m1")).rejects.toThrow("This is your only way to sign in");
  });
});
