import { describe, expect, it } from "vite-plus/test";
import { metadataWithDescription } from "./description-metadata.js";

describe("metadataWithDescription", () => {
  it("leaves metadata alone when it never held a description", () => {
    expect(metadataWithDescription(null, "New")).toBeUndefined();
    expect(metadataWithDescription({ theme: "dark" }, "New")).toBeUndefined();
  });

  it("replaces the description and keeps other keys", () => {
    expect(
      metadataWithDescription({ description: "Old", theme: "dark" }, ""),
    ).toEqual({ description: "", theme: "dark" });
  });

  it("reads metadata stored as a JSON string", () => {
    expect(
      metadataWithDescription('{"description":"Old"}', "Design team"),
    ).toEqual({ description: "Design team" });
    expect(metadataWithDescription("not json", "New")).toBeUndefined();
  });
});
