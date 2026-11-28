import { describe, expect, it } from "vite-plus/test";
import { parseSettings } from "./parse-settings.js";
import { readSettings, toPublicSettings } from "./read-settings.js";
import type { SettingsSchema } from "./types.js";

const schema = {
  label: { type: "text", label: "Label", required: true },
  token: { type: "secret", label: "Token" },
  limit: { type: "number", label: "Limit", min: 1, max: 10, default: 5 },
  enabled: { type: "boolean", label: "Enabled" },
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

describe("parseSettings", () => {
  it("stores only explicitly set values", () => {
    const result = parseSettings(schema, { label: "Ops", limit: 3 });
    expect(result).toEqual({ ok: true, values: { label: "Ops", limit: 3 } });
  });

  it("reports every invalid field", () => {
    const result = parseSettings(schema, {
      limit: 50,
      enabled: "yes",
      mode: "slow",
      days: ["sun"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "days",
      "enabled",
      "label",
      "limit",
      "mode",
    ]);
  });

  it("keeps a stored secret when the input omits it", () => {
    const result = parseSettings(schema, { label: "Ops" }, { token: "abc" });
    expect(result).toEqual({
      ok: true,
      values: { label: "Ops", token: "abc" },
    });
  });

  it("clears a secret when the input sends null", () => {
    const result = parseSettings(
      schema,
      { label: "Ops", token: null },
      { token: "abc" },
    );
    expect(result).toEqual({ ok: true, values: { label: "Ops" } });
  });

  it("drops unknown keys and dedupes multiselect values", () => {
    const result = parseSettings(schema, {
      label: "Ops",
      days: ["mon", "mon", "tue"],
      extra: true,
    });
    expect(result).toEqual({
      ok: true,
      values: { label: "Ops", days: ["mon", "tue"] },
    });
  });
});

describe("readSettings", () => {
  it("applies defaults and ignores stale values", () => {
    expect(
      readSettings(schema, { label: "Ops", limit: 99, mode: "gone" }),
    ).toEqual({
      label: "Ops",
      limit: 5,
      enabled: false,
      days: ["mon"],
    });
  });

  it("hides secrets from the public view", () => {
    expect(toPublicSettings(schema, { label: "Ops", token: "abc" })).toEqual({
      values: { label: "Ops", limit: 5, enabled: false, days: ["mon"] },
      configuredSecrets: ["token"],
    });
  });
});
