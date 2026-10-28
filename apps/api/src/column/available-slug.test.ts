import { describe, expect, it } from "vite-plus/test";
import { availableSlug } from "./available-slug";

describe("availableSlug", () => {
  it("keeps a free slug", () => {
    expect(availableSlug("in-review", new Set(["to-do"]))).toBe("in-review");
  });

  it("suffixes a taken slug with the first free number", () => {
    expect(
      availableSlug("in-review", new Set(["in-review", "in-review-2"])),
    ).toBe("in-review-3");
  });
});
