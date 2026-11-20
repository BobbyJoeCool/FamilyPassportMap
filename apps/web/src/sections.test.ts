import { describe, it, expect } from "vitest";
import { SECTION_TABS, parseSectionPath } from "./sections";

describe("parseSectionPath", () => {
  it("reads the section and tab from a section route", () => {
    expect(parseSectionPath("/us/compare")).toEqual({ section: "us", tab: "compare" });
    expect(parseSectionPath("/world/list")).toEqual({ section: "world", tab: "list" });
  });

  it("defaults to the map tab at a section's root", () => {
    expect(parseSectionPath("/us")).toEqual({ section: "us", tab: "map" });
    expect(parseSectionPath("/world/")).toEqual({ section: "world", tab: "map" });
  });

  it("returns null outside both sections", () => {
    // People, privacy, the root and look-alike paths have no section tabs.
    for (const path of ["/people", "/privacy", "/", "/usa/map", "/worldwide"]) {
      expect(parseSectionPath(path)).toBeNull();
    }
  });
});

describe("SECTION_TABS", () => {
  it("is Map, Compare, List in that order", () => {
    expect(SECTION_TABS.map((tab) => tab.label)).toEqual(["Map", "Compare", "List"]);
  });

  // That every tab has a matching route in App.tsx is tested by rendering the app (App.test.tsx).
});
