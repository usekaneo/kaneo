import { describe, expect, it } from "vite-plus/test";
import {
  getWorkspaceDescription,
  normalizeWorkspaceValues,
} from "./workspace-form-values";

describe("normalizeWorkspaceValues", () => {
  it("trims the name and description", () => {
    expect(
      normalizeWorkspaceValues({ name: "  Studio ", description: undefined }),
    ).toEqual({ name: "Studio", description: "" });
  });
});

describe("getWorkspaceDescription", () => {
  it("prefers the description column", () => {
    expect(
      getWorkspaceDescription({
        description: "Column",
        metadata: { description: "Metadata" },
      }),
    ).toBe("Column");
  });

  it("falls back to the metadata description", () => {
    expect(
      getWorkspaceDescription({ metadata: { description: "Metadata" } }),
    ).toBe("Metadata");
  });

  it("returns an empty string when nothing is set", () => {
    expect(getWorkspaceDescription(undefined)).toBe("");
    expect(getWorkspaceDescription({ metadata: null })).toBe("");
  });
});
