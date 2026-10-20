import { describe, expect, it } from "vite-plus/test";
import {
  customFieldsPayload,
  draftFieldValues,
  hasMissingRequired,
  isFieldValueEmpty,
} from "./new-task-fields";

const field = (
  id: string,
  type: string,
  required = false,
  defaultValue: string | null = null,
) => ({ id, type, required, defaultValue });

describe("isFieldValueEmpty", () => {
  it("treats blanks and empty multiselects as empty", () => {
    expect(isFieldValueEmpty(undefined, "number")).toBe(true);
    expect(isFieldValueEmpty("  ", "number")).toBe(true);
    expect(isFieldValueEmpty("[]", "multiselect")).toBe(true);
    expect(isFieldValueEmpty('["a"]', "multiselect")).toBe(false);
    expect(isFieldValueEmpty("false", "boolean")).toBe(false);
  });
});

describe("draftFieldValues", () => {
  it("seeds defaults and keeps the person's edits over them", () => {
    const fields = [
      field("size", "number", true, "3"),
      field("tags", "multiselect", false, '["a"]'),
      field("due", "date"),
    ];
    expect(draftFieldValues(fields, {})).toEqual({ size: "3", tags: '["a"]' });
    expect(draftFieldValues(fields, { size: "5", tags: "[]" })).toEqual({
      size: "5",
      tags: "[]",
    });
  });

  it("ignores empty defaults and saves an untouched required switch as off", () => {
    const fields = [
      field("tags", "multiselect", true, "[]"),
      field("done", "boolean", true),
      field("flag", "boolean"),
    ];
    expect(draftFieldValues(fields, {})).toEqual({ done: "false" });
  });
});

describe("hasMissingRequired", () => {
  it("is satisfied by a valid default", () => {
    const fields = [field("size", "number", true, "3")];
    expect(hasMissingRequired(fields, draftFieldValues(fields, {}))).toBe(
      false,
    );
    expect(hasMissingRequired(fields, { size: "" })).toBe(true);
  });
});

describe("customFieldsPayload", () => {
  it("sends only non-empty values of the project's fields", () => {
    const fields = [field("a", "number"), field("b", "multiselect")];
    expect(customFieldsPayload(fields, { a: "1", b: "[]", c: "x" })).toEqual([
      { fieldId: "a", value: "1" },
    ]);
  });
});
