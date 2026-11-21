import { describe, it, expect } from "vitest";
import { DEFAULT_LANDING_PATH, isProvider, PROVIDER_LABELS, PROVIDERS, SIGN_IN_ERRORS, safeReturnTo } from "./signIn.js";
import { userLabel } from "./currentUser.js";

describe("safeReturnTo", () => {
  it("keeps an in-app path, including its query and hash", () => {
    expect(safeReturnTo("/world/list")).toBe("/world/list");
    expect(safeReturnTo("/us/map?x=1#top")).toBe("/us/map?x=1#top");
    expect(safeReturnTo("/")).toBe("/");
  });

  it("falls back to the US map for anything that could leave the app", () => {
    // Every one of these is either another origin or not a path at all.
    for (const value of ["//evil.example", "/\\evil.example", "https://evil.example/", "evil.example", "us/map", ""]) {
      expect(safeReturnTo(value)).toBe(DEFAULT_LANDING_PATH);
    }
  });

  it("falls back for a backslash anywhere in the path", () => {
    expect(safeReturnTo("/us\\..\\map")).toBe(DEFAULT_LANDING_PATH);
  });

  it("falls back for missing or non-string values", () => {
    // Query parsing can hand over undefined, arrays or objects.
    for (const value of [undefined, null, 42, ["/us/map"], { path: "/us/map" }]) {
      expect(safeReturnTo(value)).toBe(DEFAULT_LANDING_PATH);
    }
  });

  it("lands on the US map by default", () => {
    expect(DEFAULT_LANDING_PATH).toBe("/us/map");
  });
});

describe("SIGN_IN_ERRORS", () => {
  it("has the three reasons the sign-in pages know how to explain", () => {
    expect([...SIGN_IN_ERRORS]).toEqual(["cancelled", "failed", "taken"]);
  });
});

describe("providers", () => {
  it("are Microsoft, Google and GitHub, each with a label", () => {
    expect([...PROVIDERS]).toEqual(["microsoft", "google", "github"]);
    expect(PROVIDERS.map((provider) => PROVIDER_LABELS[provider])).toEqual(["Microsoft", "Google", "GitHub"]);
  });

  it("recognizes only those three", () => {
    expect(isProvider("google")).toBe(true);
    for (const value of ["apple", "Google", "", undefined, 1]) expect(isProvider(value)).toBe(false);
  });
});

describe("userLabel", () => {
  it("prefers the display name, then the email, then 'New user'", () => {
    expect(userLabel({ displayName: "Ann", email: "a@b.c" })).toBe("Ann");
    expect(userLabel({ displayName: "", email: "a@b.c" })).toBe("a@b.c");
    expect(userLabel({ displayName: "", email: null })).toBe("New user");
  });
});
