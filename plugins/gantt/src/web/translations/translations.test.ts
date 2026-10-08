import { describe, expect, it } from "vite-plus/test";
import { enUS } from "./en-US.js";
import { translations } from "./index.js";

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  return Object.assign(
    {},
    ...Object.entries(value as Record<string, unknown>).map(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    ),
  );
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

const english = flatten(enUS);

describe("translations", () => {
  it.each(Object.entries(translations))(
    "%s has every key with the same placeholders",
    (_locale, messages) => {
      const flat = flatten(messages);
      expect(Object.keys(flat).sort()).toEqual(Object.keys(english).sort());
      for (const [key, text] of Object.entries(english)) {
        expect(placeholders(flat[key] ?? "")).toEqual(placeholders(text));
      }
    },
  );
});
