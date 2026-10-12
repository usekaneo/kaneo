import { describe, expect, it } from "vite-plus/test";
import type { FieldJson } from "./field-json.js";
import { matchField } from "./match-field.js";

function field(id: string, name: string): FieldJson {
  return {
    id,
    name,
    type: "text",
    required: false,
    defaultValue: null,
    options: [],
  };
}

const estimate = field("f_est", "Story points");
const platform = field("f_plat", "Platform");

describe("matchField", () => {
  it("matches the id, the name, or the name without spaces and case", () => {
    expect(matchField([estimate, platform], "f_plat")).toBe(platform);
    expect(matchField([estimate, platform], "story POINTS")).toBe(estimate);
    expect(matchField([estimate, platform], "story-points")).toBe(estimate);
  });

  it("refuses names shared by two fields", () => {
    const twin = field("f_twin", "platform");
    expect(matchField([platform, twin], "Platform")).toBeUndefined();
    expect(matchField([platform, twin], "f_twin")).toBe(twin);
  });

  it("returns nothing for blank or unknown references", () => {
    expect(matchField([estimate], " ")).toBeUndefined();
    expect(matchField([estimate], "Priority")).toBeUndefined();
  });
});
