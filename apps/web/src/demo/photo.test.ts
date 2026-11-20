import { describe, expect, it } from "vitest";
import { AVATAR_SIZE_PX, centerSquareCrop } from "./photo";

// jsdom has no canvas, so the actual 256×256 output is checked in the demo E2E test
// (e2e/demo/demo.spec.ts). Here: the crop maths that decides what's kept.
describe("centerSquareCrop", () => {
  it("keeps the middle of a landscape image", () => {
    expect(centerSquareCrop(1000, 600)).toEqual({ sx: 200, sy: 0, size: 600 });
  });

  it("keeps the middle of a portrait image", () => {
    expect(centerSquareCrop(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 });
  });

  it("keeps all of a square image", () => {
    expect(centerSquareCrop(256, 256)).toEqual({ sx: 0, sy: 0, size: 256 });
  });

  it("rounds an odd margin down to whole pixels", () => {
    expect(centerSquareCrop(5, 2)).toEqual({ sx: 1, sy: 0, size: 2 });
  });

  it("matches the server's avatar size", () => {
    expect(AVATAR_SIZE_PX).toBe(256);
  });
});
