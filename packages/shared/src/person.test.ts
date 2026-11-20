import { describe, it, expect } from "vitest";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PEOPLE_PER_USER,
  MAX_PHOTO_SIZE_BYTES,
  PEOPLE_CAP_MESSAGE,
  createPersonSchema,
  hexColorSchema,
  updatePersonSchema,
} from "./person.js";

describe("hexColorSchema", () => {
  it("accepts a six-digit hex color in either case", () => {
    expect(hexColorSchema.safeParse("#3366cc").success).toBe(true);
    expect(hexColorSchema.safeParse("#3366CC").success).toBe(true);
  });

  it("rejects shorthand, missing #, named colors and extra characters", () => {
    // Each malformed value must fail on its own.
    for (const value of ["#36c", "3366cc", "blue", "#3366ccff", "#gggggg", ""]) {
      expect(hexColorSchema.safeParse(value).success).toBe(false);
    }
  });

  it("explains the expected format", () => {
    const result = hexColorSchema.safeParse("red");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Must be a hex color like #3366CC");
  });
});

describe("createPersonSchema", () => {
  it("accepts a name and color, trimming the name", () => {
    const result = createPersonSchema.safeParse({ name: "  Alice  ", colorHex: "#3366cc" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Alice", colorHex: "#3366cc" });
  });

  it("rejects an empty or whitespace-only name with 'Name is required'", () => {
    // Both blank forms are the same error.
    for (const name of ["", "   "]) {
      const result = createPersonSchema.safeParse({ name, colorHex: "#3366cc" });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Name is required");
    }
  });

  it("accepts a long name (there is no maximum length)", () => {
    expect(createPersonSchema.safeParse({ name: "A".repeat(500), colorHex: "#3366cc" }).success).toBe(true);
  });

  it("requires both fields", () => {
    expect(createPersonSchema.safeParse({ name: "Alice" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ colorHex: "#3366cc" }).success).toBe(false);
    expect(createPersonSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string name", () => {
    expect(createPersonSchema.safeParse({ name: 42, colorHex: "#3366cc" }).success).toBe(false);
  });
});

describe("updatePersonSchema", () => {
  it("accepts an empty update and either field alone", () => {
    expect(updatePersonSchema.safeParse({}).success).toBe(true);
    expect(updatePersonSchema.safeParse({ name: "Bob" }).success).toBe(true);
    expect(updatePersonSchema.safeParse({ colorHex: "#000000" }).success).toBe(true);
  });

  it("still rejects a blank name or a bad color when given", () => {
    expect(updatePersonSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(updatePersonSchema.safeParse({ colorHex: "#fff" }).success).toBe(false);
  });

  it("trims a given name", () => {
    expect(updatePersonSchema.safeParse({ name: " Bob " }).data).toEqual({ name: "Bob" });
  });
});

describe("photo and People limits", () => {
  it("allows JPEG, PNG and WebP up to 5 MB", () => {
    expect([...ALLOWED_PHOTO_MIME_TYPES]).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(MAX_PHOTO_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("caps People at 10 and says so in the cap message", () => {
    expect(MAX_PEOPLE_PER_USER).toBe(10);
    expect(PEOPLE_CAP_MESSAGE).toBe("You can have up to 10 people, including yourself.");
  });
});
