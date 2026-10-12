import { describe, expect, it } from "vite-plus/test";
import { resolveWorkspaceDescription } from "./resolve-workspace-description";

describe("resolveWorkspaceDescription", () => {
  it("prefers the description column", () => {
    expect(
      resolveWorkspaceDescription({
        description: "From the column",
        metadata: JSON.stringify({ description: "From metadata" }),
      }),
    ).toBe("From the column");
  });

  it("falls back to metadata.description when the column is empty", () => {
    expect(
      resolveWorkspaceDescription({
        description: null,
        metadata: JSON.stringify({ description: "From metadata" }),
      }),
    ).toBe("From metadata");
  });

  it("falls back to metadata.description when the column is blank", () => {
    expect(
      resolveWorkspaceDescription({
        description: "   ",
        metadata: JSON.stringify({ description: "From metadata" }),
      }),
    ).toBe("From metadata");
  });

  it("returns null when neither source has a description", () => {
    expect(
      resolveWorkspaceDescription({ description: null, metadata: null }),
    ).toBeNull();
    expect(
      resolveWorkspaceDescription({ description: "", metadata: "{}" }),
    ).toBeNull();
  });

  it("ignores a blank metadata description", () => {
    expect(
      resolveWorkspaceDescription({
        description: null,
        metadata: JSON.stringify({ description: " \n " }),
      }),
    ).toBeNull();
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a JSON string", JSON.stringify("Just a string")],
    ["a JSON number", "42"],
    ["a JSON null", "null"],
    ["a JSON array", JSON.stringify([{ description: "In an array" }])],
    ["a non-string description", JSON.stringify({ description: 42 })],
    ["a nested description", JSON.stringify({ description: { text: "x" } })],
  ])("tolerates metadata that is %s", (_label, metadata) => {
    expect(
      resolveWorkspaceDescription({ description: null, metadata }),
    ).toBeNull();
  });
});
