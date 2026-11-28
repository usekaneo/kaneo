import type { SettingsSchema } from "@kaneo/plugin-sdk";
import { describe, expect, it } from "vite-plus/test";
import {
  hasSettingsChanges,
  toFormValues,
  toSettingsPayload,
} from "./settings-form-values";

const schema = {
  label: { type: "text", label: "Label", default: "Ops" },
  notes: { type: "text", label: "Notes", multiline: true },
  token: { type: "secret", label: "Token" },
  webhook: { type: "secret", label: "Webhook" },
  limit: { type: "number", label: "Limit", min: 1, max: 10 },
  enabled: { type: "boolean", label: "Enabled", default: true },
  mode: {
    type: "select",
    label: "Mode",
    options: [
      { value: "fast", label: "Fast" },
      { value: "safe", label: "Safe" },
    ],
  },
  days: {
    type: "multiselect",
    label: "Days",
    options: [
      { value: "mon", label: "Monday" },
      { value: "tue", label: "Tuesday" },
    ],
    default: ["mon"],
  },
} satisfies SettingsSchema;

describe("toFormValues", () => {
  it("applies defaults and starts secrets in their configured state", () => {
    expect(toFormValues(schema, { limit: 3, mode: "gone" }, ["token"])).toEqual(
      {
        label: "Ops",
        notes: "",
        token: { mode: "keep" },
        webhook: { mode: "replace", value: "" },
        limit: "3",
        enabled: true,
        mode: "",
        days: ["mon"],
      },
    );
  });
});

describe("toSettingsPayload", () => {
  const base = toFormValues(schema, { limit: 3 }, ["token"]);

  it("sends every public field and leaves kept secrets out", () => {
    expect(toSettingsPayload(schema, base)).toEqual({
      label: "Ops",
      notes: null,
      limit: 3,
      enabled: true,
      mode: null,
      days: ["mon"],
    });
  });

  it("replaces, clears and ignores blank secrets", () => {
    expect(
      toSettingsPayload(schema, {
        ...base,
        token: { mode: "clear" },
        webhook: { mode: "replace", value: "https://hooks.test" },
      }),
    ).toMatchObject({ token: null, webhook: "https://hooks.test" });

    const blank = toSettingsPayload(schema, {
      ...base,
      token: { mode: "replace", value: "   " },
    });
    expect(blank).not.toHaveProperty("token");
  });

  it("converts numbers and keeps invalid input for server validation", () => {
    expect(toSettingsPayload(schema, { ...base, limit: "" }).limit).toBeNull();
    expect(toSettingsPayload(schema, { ...base, limit: " 7 " }).limit).toBe(7);
    expect(toSettingsPayload(schema, { ...base, limit: "abc" }).limit).toBe(
      "abc",
    );
  });
});

describe("hasSettingsChanges", () => {
  it("compares the values that would be sent", () => {
    const initial = toFormValues(schema, {}, []);

    expect(hasSettingsChanges(schema, initial, { ...initial })).toBe(false);
    expect(
      hasSettingsChanges(schema, initial, {
        ...initial,
        webhook: { mode: "replace", value: " " },
      }),
    ).toBe(false);
    expect(
      hasSettingsChanges(schema, initial, { ...initial, days: ["tue"] }),
    ).toBe(true);
  });
});
