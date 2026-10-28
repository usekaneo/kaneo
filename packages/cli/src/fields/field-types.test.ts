import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  checkFieldOptions,
  fieldOptions,
  parseFieldType,
} from "./field-types.js";

describe("parseFieldType", () => {
  it("accepts the API names and friendly aliases", () => {
    expect(parseFieldType("Number")).toEqual(Result.succeed("number"));
    expect(parseFieldType("select")).toEqual(Result.succeed("dropdown"));
    expect(parseFieldType("multi-select")).toEqual(
      Result.succeed("multiselect"),
    );
    expect(parseFieldType("checkbox")).toEqual(Result.succeed("boolean"));
  });

  it("lists the types when the input is unknown", () => {
    const result = parseFieldType("color");
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Use one of: text, number, date, dropdown, multiselect, boolean.",
    );
  });
});

describe("checkFieldOptions", () => {
  it("trims and removes duplicate options", () => {
    expect(checkFieldOptions("dropdown", [" iOS ", "iOS", "", "Web"])).toEqual(
      Result.succeed(["iOS", "Web"]),
    );
  });

  it("needs one option for a dropdown and two for a multi-select", () => {
    expect(Result.isFailure(checkFieldOptions("dropdown", []))).toBe(true);
    const multi = checkFieldOptions("multiselect", ["iOS", "iOS"]);
    expect(Result.isFailure(multi) && multi.failure.message).toBe(
      "A multi-select field needs at least two options.",
    );
  });

  it("refuses options for types without choices", () => {
    expect(checkFieldOptions("text", [])).toEqual(Result.succeed(undefined));
    const result = checkFieldOptions("number", ["1"]);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "A number field has no options.",
    );
  });
});

describe("fieldOptions", () => {
  it("reads arrays and JSON strings and ignores anything else", () => {
    expect(fieldOptions(["a", 1, "b"])).toEqual(["a", "b"]);
    expect(fieldOptions('["x","y"]')).toEqual(["x", "y"]);
    expect(fieldOptions(null)).toEqual([]);
    expect(fieldOptions("oops")).toEqual([]);
  });
});
