import { describe, expect, it } from "vite-plus/test";

import {
  canSaveField,
  fieldOptions,
  toCreateFieldBody,
  validFieldDefault,
  type CustomFieldType,
  type FieldForm,
} from "./field-form";

const form: FieldForm = {
  name: " Platform ",
  type: "text",
  required: true,
  optionsText: "Android, iOS",
  defaultValue: "Android",
};

describe("required custom field defaults", () => {
  it.each<CustomFieldType>([
    "text",
    "number",
    "date",
    "boolean",
    "dropdown",
    "multiselect",
  ])("rejects missing and blank defaults for %s", (type) => {
    expect(canSaveField({ ...form, type, defaultValue: "" })).toBe(false);
    expect(canSaveField({ ...form, type, defaultValue: "  " })).toBe(false);
  });

  it.each([
    ["0", true],
    ["-1.25", true],
    [" 2e+3 ", true],
    ["1e999", false],
    ["Infinity", false],
    ["NaN", false],
    ["0x10", false],
    [".5", false],
    ["1.", false],
    ["1,5", false],
    ["1e", false],
    ["12px", false],
  ])("validates numeric default %s", (value, valid) => {
    expect(validFieldDefault("number", value, [])).toBe(valid);
  });

  it.each([
    ["2024-02-29", true],
    ["2026-10-17", true],
    ["2026-10-17T12:30:00.000Z", true],
    ["2025-02-29", false],
    ["2026-02-30", false],
    ["2026-13-01", false],
    ["2026-00-01", false],
    ["10/17/2026", false],
    ["2026-10-17T25:00:00Z", false],
  ])("validates calendar default %s", (value, valid) => {
    expect(validFieldDefault("date", value, [])).toBe(valid);
  });

  it("accepts both boolean states, including unchecked", () => {
    expect(validFieldDefault("boolean", "true", [])).toBe(true);
    expect(
      canSaveField({ ...form, type: "boolean", defaultValue: "false" }),
    ).toBe(true);
    expect(validFieldDefault("boolean", "yes", [])).toBe(false);
  });

  it("requires dropdown defaults to match a current option", () => {
    expect(canSaveField({ ...form, type: "dropdown" })).toBe(true);
    expect(
      canSaveField({ ...form, type: "dropdown", optionsText: "iOS" }),
    ).toBe(false);
  });

  it.each([
    ['["Android"]', true],
    ['["Android","iOS"]', true],
    ["[]", false],
    ["Android", false],
    ['"Android"', false],
    ['["Web"]', false],
    ['["Android",1]', false],
    ["null", false],
  ])("validates multiselect default %s", (value, valid) => {
    expect(validFieldDefault("multiselect", value, ["Android", "iOS"])).toBe(
      valid,
    );
  });

  it("requires two distinct multiselect options even for optional fields", () => {
    expect(fieldOptions(" Android, Android, , iOS ")).toEqual([
      "Android",
      "iOS",
    ]);
    expect(
      canSaveField({
        ...form,
        type: "multiselect",
        required: false,
        optionsText: "Android, Android",
      }),
    ).toBe(false);
    expect(
      canSaveField({
        ...form,
        type: "dropdown",
        required: false,
        optionsText: "",
      }),
    ).toBe(false);
  });

  it("checks defaults when Required is switched on", () => {
    expect(canSaveField({ ...form, required: false, defaultValue: "" })).toBe(
      true,
    );
    expect(canSaveField({ ...form, required: true, defaultValue: "" })).toBe(
      false,
    );
    expect(canSaveField({ ...form, name: " " })).toBe(false);
  });
});

describe("create payload", () => {
  it("includes a typed default for each required field", () => {
    const defaults: [CustomFieldType, string][] = [
      ["text", " Android "],
      ["number", "0"],
      ["date", "2026-10-17"],
      ["boolean", "false"],
      ["dropdown", "Android"],
      ["multiselect", '["Android"]'],
    ];
    for (const [type, defaultValue] of defaults) {
      const current = { ...form, type, defaultValue };
      expect(canSaveField(current)).toBe(true);
      expect(toCreateFieldBody(current)).toMatchObject({
        name: "Platform",
        type,
        required: true,
        defaultValue,
      });
    }
  });

  it("omits the hidden default after Required is switched off", () => {
    expect(
      toCreateFieldBody({ ...form, required: false }).defaultValue,
    ).toBeUndefined();
  });

  it("sends normalized options and trims non-text defaults", () => {
    expect(
      toCreateFieldBody({
        ...form,
        type: "dropdown",
        defaultValue: " Android ",
        optionsText: " Android, Android, iOS, ",
      }),
    ).toMatchObject({
      options: ["Android", "iOS"],
      defaultValue: "Android",
    });
  });
});
