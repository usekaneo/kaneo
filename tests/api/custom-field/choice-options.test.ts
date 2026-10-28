import { describe, expect, it } from "vite-plus/test";
import {
  convertChoiceValue,
  findUsedOptions,
  normalizeOptions,
  parseChoiceValue,
  readOptions,
} from "../../../apps/api/src/custom-field/choice-options";

describe("choice options", () => {
  it("reads only string options", () => {
    expect(readOptions(["a", 1, "b"])).toEqual(["a", "b"]);
    expect(readOptions(null)).toEqual([]);
  });

  it("trims, drops blanks, and removes duplicates", () => {
    expect(normalizeOptions([" Small", "Medium", "", "Small "])).toEqual([
      "Small",
      "Medium",
    ]);
  });

  it("parses dropdown and multiselect values", () => {
    expect(parseChoiceValue(" Small ", "dropdown")).toEqual(["Small"]);
    expect(parseChoiceValue("", "dropdown")).toEqual([]);
    expect(parseChoiceValue('["iOS","Web"]', "multiselect")).toEqual([
      "iOS",
      "Web",
    ]);
    expect(parseChoiceValue("not json", "multiselect")).toEqual([]);
    expect(parseChoiceValue(null, "multiselect")).toEqual([]);
  });

  it("converts dropdown values to multiselect and back", () => {
    expect(convertChoiceValue("Small", "dropdown", "multiselect")).toBe(
      '["Small"]',
    );
    expect(convertChoiceValue("", "dropdown", "multiselect")).toBe("");
    expect(convertChoiceValue('["Small"]', "multiselect", "dropdown")).toBe(
      "Small",
    );
    expect(convertChoiceValue("[]", "multiselect", "dropdown")).toBe("");
  });

  it("refuses to squeeze several picks into a dropdown", () => {
    expect(
      convertChoiceValue('["iOS","Web"]', "multiselect", "dropdown"),
    ).toBeUndefined();
  });

  it("finds which candidate options tasks still use", () => {
    expect(
      findUsedOptions(["Small", null, ""], "dropdown", ["Small", "Large"]),
    ).toEqual(["Small"]);
    expect(
      findUsedOptions(['["iOS"]', '["Web","iOS"]'], "multiselect", [
        "Android",
        "Web",
      ]),
    ).toEqual(["Web"]);
  });
});
