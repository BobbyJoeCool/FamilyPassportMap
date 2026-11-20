import { describe, it, expect } from "vitest";
import { DEFAULT_LANDING_PATH, SIGN_IN_ERRORS, safeReturnTo } from "./signIn.js";

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
  it("has the two reasons the sign-in page knows how to explain", () => {
    expect([...SIGN_IN_ERRORS]).toEqual(["cancelled", "failed"]);
  });
});
