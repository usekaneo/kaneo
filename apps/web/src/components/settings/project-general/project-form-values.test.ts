import { describe, expect, it } from "vite-plus/test";
import {
  getProjectFieldChanges,
  hasProjectFieldChanges,
  normalizeProjectValues,
} from "./project-form-values";

describe("normalizeProjectValues", () => {
  it("trims text fields and falls back to the default icon", () => {
    expect(
      normalizeProjectValues({
        name: "  Website  ",
        slug: " WEB ",
        description: undefined,
        icon: "",
      }),
    ).toEqual({
      name: "Website",
      slug: "WEB",
      description: "",
      icon: "Layout",
    });
  });
});

describe("getProjectFieldChanges", () => {
  const saved = {
    name: "Website",
    slug: "WEB",
    description: "",
    icon: "Layout",
  };

  it("reports no changes for identical values", () => {
    const changes = getProjectFieldChanges(saved, { ...saved });
    expect(hasProjectFieldChanges(changes)).toBe(false);
  });

  it("flags only the fields that differ", () => {
    expect(getProjectFieldChanges(saved, { ...saved, slug: "SITE" })).toEqual({
      name: false,
      slug: true,
      description: false,
      icon: false,
    });
  });

  it("treats every field as changed before anything was saved", () => {
    expect(hasProjectFieldChanges(getProjectFieldChanges(null, saved))).toBe(
      true,
    );
  });
});
