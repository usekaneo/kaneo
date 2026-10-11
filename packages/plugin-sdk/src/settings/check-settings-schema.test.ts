import { describe, expect, it } from "vite-plus/test";
import { checkSettingsSchema } from "./check-settings-schema.js";
import type { SettingsSchema } from "./types.js";

const options = [
  { value: "fast", label: "Fast" },
  { value: "safe", label: "Safe" },
];

const valid = {
  label: {
    type: "text",
    label: "Label",
    description: "Shown on the board",
    placeholder: "Ops",
    multiline: true,
    required: true,
    default: "Ops",
  },
  token: { type: "secret", label: "Token", placeholder: "abc", required: true },
  limit: {
    type: "number",
    label: "Limit",
    min: 1,
    max: 10,
    step: 1,
    required: true,
    default: 5,
  },
  enabled: { type: "boolean", label: "Enabled", default: true },
  mode: {
    type: "select",
    label: "Mode",
    options,
    required: true,
    default: "safe",
  },
  days: {
    type: "multiselect",
    label: "Days",
    options,
    default: ["fast", "safe"],
  },
  empty: { type: "select", label: "Empty", options: [] },
} satisfies SettingsSchema;

describe("checkSettingsSchema", () => {
  it("accepts every field kind with all of its properties", () => {
    expect(checkSettingsSchema(valid)).toEqual([]);
  });

  it("accepts fields with only a type and a label", () => {
    expect(
      checkSettingsSchema({
        a: { type: "text", label: "A" },
        b: { type: "secret", label: "B" },
        c: { type: "number", label: "C" },
        d: { type: "boolean", label: "D" },
        e: { type: "select", label: "E", options },
        f: { type: "multiselect", label: "F", options },
      }),
    ).toEqual([]);
  });

  it("accepts an empty schema", () => {
    expect(checkSettingsSchema({})).toEqual([]);
  });

  it("rejects a schema that is not an object", () => {
    for (const schema of [null, undefined, "text", []]) {
      expect(checkSettingsSchema(schema)).toEqual([
        "Settings must be an object of fields",
      ]);
    }
  });

  it("rejects a field that is not an object", () => {
    expect(checkSettingsSchema({ mode: "select" })).toEqual([
      'Setting "mode" must be an object',
    ]);
  });

  it("rejects a missing or unknown type", () => {
    expect(
      checkSettingsSchema({
        mode: { label: "Mode" },
        size: { type: 3, label: "Size" },
        limit: { type: "slider", label: "Limit" },
        proto: { type: "toString", label: "Proto" },
      }),
    ).toEqual([
      'Setting "mode" needs a type',
      'Setting "size" needs a type',
      'Setting "limit" has an unknown type "slider"',
      'Setting "proto" has an unknown type "toString"',
    ]);
  });

  it("rejects a missing label and a description that is not text", () => {
    expect(
      checkSettingsSchema({ name: { type: "text", description: 1 } }),
    ).toEqual([
      'Setting "name" needs a label',
      'Setting "name" description must be text',
    ]);
  });

  it("checks text properties", () => {
    expect(
      checkSettingsSchema({
        name: {
          type: "text",
          label: "Name",
          placeholder: 1,
          multiline: "yes",
          required: "no",
          default: 2,
        },
      }),
    ).toEqual([
      'Setting "name" placeholder must be text',
      'Setting "name" multiline must be true or false',
      'Setting "name" required must be true or false',
      'Setting "name" default must be text',
    ]);
  });

  it("checks secret properties", () => {
    expect(
      checkSettingsSchema({
        token: { type: "secret", label: "Token", placeholder: false },
      }),
    ).toEqual(['Setting "token" placeholder must be text']);
  });

  it("checks number properties and range", () => {
    expect(
      checkSettingsSchema({
        limit: {
          type: "number",
          label: "Limit",
          min: "1",
          max: Number.NaN,
          step: Infinity,
          default: "5",
        },
        upside: { type: "number", label: "Upside", min: 10, max: 1 },
        low: { type: "number", label: "Low", min: 1, default: 0 },
        high: { type: "number", label: "High", max: 10, default: 11 },
      }),
    ).toEqual([
      'Setting "limit" min must be a number',
      'Setting "limit" max must be a number',
      'Setting "limit" step must be a number',
      'Setting "limit" default must be a number',
      'Setting "upside" min is greater than max',
      'Setting "low" default must be at least 1',
      'Setting "high" default must be at most 10',
    ]);
  });

  it("checks boolean properties", () => {
    expect(
      checkSettingsSchema({
        enabled: { type: "boolean", label: "Enabled", default: "true" },
      }),
    ).toEqual(['Setting "enabled" default must be true or false']);
  });

  it("rejects a select or multiselect without options", () => {
    expect(
      checkSettingsSchema({
        mode: { type: "select", label: "Mode" },
        days: { type: "multiselect", label: "Days", options: "mon" },
      }),
    ).toEqual([
      'Setting "mode" is a select without options',
      'Setting "days" is a multiselect without options',
    ]);
  });

  it("rejects options without a text value and label", () => {
    expect(
      checkSettingsSchema({
        mode: {
          type: "select",
          label: "Mode",
          options: [{ value: "fast", label: "Fast" }, null, { value: 1 }],
          default: "fast",
        },
      }),
    ).toEqual([
      'Setting "mode" option 2 needs a text value and label',
      'Setting "mode" option 3 needs a text value and label',
    ]);
  });

  it("checks select properties and defaults", () => {
    expect(
      checkSettingsSchema({
        mode: { type: "select", label: "Mode", options, default: "slow" },
        speed: { type: "select", label: "Speed", options, default: ["fast"] },
        pick: { type: "select", label: "Pick", options, required: 1 },
      }),
    ).toEqual([
      'Setting "mode" default "slow" is not one of its options',
      'Setting "speed" default must be an option value',
      'Setting "pick" required must be true or false',
    ]);
  });

  it("checks multiselect defaults", () => {
    expect(
      checkSettingsSchema({
        days: { type: "multiselect", label: "Days", options, default: "fast" },
        tags: {
          type: "multiselect",
          label: "Tags",
          options,
          default: ["fast", 1],
        },
        modes: {
          type: "multiselect",
          label: "Modes",
          options,
          default: ["fast", "slow", "slower"],
        },
      }),
    ).toEqual([
      'Setting "days" default must be a list of option values',
      'Setting "tags" default must be a list of option values',
      'Setting "modes" default "slow" is not one of its options',
      'Setting "modes" default "slower" is not one of its options',
    ]);
  });
});
