import type { Translations } from "@kaneo/plugin-sdk/web";
import { describe, expect, it } from "vite-plus/test";
import { enUS } from "./en-US.js";
import { translations } from "./index.js";

type AppCatalog = {
  tasks?: {
    gantt?: Record<string, string>;
    filterBar?: Record<string, string>;
  };
};

const appCatalogs = Object.fromEntries(
  Object.entries(
    import.meta.glob<AppCatalog>(
      ["../../../../../i18n/*.json", "!../../../../../i18n/schema.json"],
      { eager: true, import: "default" },
    ),
  ).map(([path, catalog]) => [
    path.slice(path.lastIndexOf("/") + 1, -".json".length),
    catalog,
  ]),
);

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
const bundles: Translations = translations;

const appLocales = Object.keys(appCatalogs);

function readAppGantt(locale: string): Record<string, string> {
  return appCatalogs[locale]?.tasks?.gantt ?? {};
}

function expectSameShape(messages: Record<string, unknown> | undefined) {
  expect(messages).toBeDefined();
  const flat = flatten(messages);
  expect(Object.keys(flat).sort()).toEqual(Object.keys(english).sort());
  for (const [key, text] of Object.entries(english)) {
    expect(placeholders(flat[key] ?? ""), key).toEqual(placeholders(text));
  }
}

describe("translations", () => {
  it("reads Kaneo's locale catalogs", () => {
    expect(appLocales).toContain("en-US");
  });

  it.each(appLocales)(
    "%s has every key with the same placeholders",
    (locale) => {
      expectSameShape(bundles[locale]);
    },
  );

  it.each(Object.keys(bundles))(
    "registered bundle %s has every key with the same placeholders",
    (locale) => {
      expectSameShape(bundles[locale]);
    },
  );

  it.each(appLocales.filter((locale) => locale !== "en-US"))(
    "%s does not fall back to English where Kaneo has a translation",
    (locale) => {
      const appGantt = readAppGantt(locale);
      const englishGantt = readAppGantt("en-US");
      const flat = flatten(bundles[locale] ?? {});
      for (const [key, text] of Object.entries(appGantt)) {
        if (!(key in english) || text === englishGantt[key]) continue;
        expect(flat[key], key).not.toBe(english[key]);
      }
    },
  );

  it.each(appLocales)(
    "%s words an empty filtered timeline like Kaneo's filter bar",
    (locale) => {
      const flat = flatten(bundles[locale] ?? {});
      expect(flat.noMatches).toBe(
        appCatalogs[locale]?.tasks?.filterBar?.noMatches,
      );
    },
  );
});
