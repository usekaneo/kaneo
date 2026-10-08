import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  type FieldDefinition,
  fieldValueJson,
  formatFieldValue,
  parseFieldValue,
} from "./field-value.js";

const now = new Date(2026, 9, 8, 12);

function field(type: string, options: string[] = []): FieldDefinition {
  return { name: "Field", type, options };
}

function failure(result: Result.Result<string, { readonly message: string }>) {
  return Result.isFailure(result) ? result.failure.message : null;
}

describe("parseFieldValue", () => {
  it("keeps text as typed, without outer spaces", () => {
    expect(parseFieldValue(field("text"), "  Hello there ", now)).toEqual(
      Result.succeed("Hello there"),
    );
  });

  it("accepts finite numbers only", () => {
    expect(parseFieldValue(field("number"), "2.5", now)).toEqual(
      Result.succeed("2.5"),
    );
    expect(failure(parseFieldValue(field("number"), "five", now))).toBe(
      'Field: "five" is not a number.',
    );
    expect(
      Result.isFailure(parseFieldValue(field("number"), "Infinity", now)),
    ).toBe(true);
  });

  it("turns yes and no words into true and false", () => {
    expect(parseFieldValue(field("boolean"), "Yes", now)).toEqual(
      Result.succeed("true"),
    );
    expect(parseFieldValue(field("boolean"), "off", now)).toEqual(
      Result.succeed("false"),
    );
    expect(
      Result.isFailure(parseFieldValue(field("boolean"), "maybe", now)),
    ).toBe(true);
  });

  it("stores dates as YYYY-MM-DD and understands relative days", () => {
    expect(parseFieldValue(field("date"), "2026-02-28", now)).toEqual(
      Result.succeed("2026-02-28"),
    );
    expect(parseFieldValue(field("date"), "tomorrow", now)).toEqual(
      Result.succeed("2026-10-09"),
    );
    expect(parseFieldValue(field("date"), "+7d", now)).toEqual(
      Result.succeed("2026-10-15"),
    );
    expect(failure(parseFieldValue(field("date"), "2026-02-30", now))).toBe(
      'Field: "2026-02-30" is not a date.',
    );
  });

  it("matches dropdown options without caring about case", () => {
    const platform = field("dropdown", ["iOS", "Android"]);
    expect(parseFieldValue(platform, "ios", now)).toEqual(
      Result.succeed("iOS"),
    );
    const result = parseFieldValue(platform, "Web", now);
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Use one of: iOS, Android.",
    );
  });

  it("stores multi-select choices as a JSON array", () => {
    const platforms = field("multiselect", ["iOS", "Android", "Web"]);
    expect(parseFieldValue(platforms, "web, ios, Web", now)).toEqual(
      Result.succeed('["Web","iOS"]'),
    );
    expect(failure(parseFieldValue(platforms, "iOS, Desktop", now))).toBe(
      "Field: not an option: Desktop.",
    );
    expect(failure(parseFieldValue(platforms, " , ", now))).toBe(
      "Field: pick at least one option.",
    );
  });

  it("refuses an empty value and points at --clear", () => {
    const result = parseFieldValue(field("text"), "   ", now);
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Pass a value, or --clear to remove it.",
    );
  });
});

describe("fieldValueJson and formatFieldValue", () => {
  it("gives scripts typed values", () => {
    expect(fieldValueJson("number", "2.5")).toBe(2.5);
    expect(fieldValueJson("boolean", "false")).toBe(false);
    expect(fieldValueJson("multiselect", '["iOS","Web"]')).toEqual([
      "iOS",
      "Web",
    ]);
    expect(fieldValueJson("date", "2026-10-15")).toBe("2026-10-15");
  });

  it("treats empty strings and empty arrays as not set", () => {
    expect(fieldValueJson("text", "")).toBeNull();
    expect(fieldValueJson("multiselect", "[]")).toBeNull();
    expect(formatFieldValue("text", null)).toBeNull();
  });

  it("formats values for people", () => {
    expect(formatFieldValue("boolean", "true")).toBe("Yes");
    expect(formatFieldValue("multiselect", '["iOS","Web"]')).toBe("iOS, Web");
  });
});
