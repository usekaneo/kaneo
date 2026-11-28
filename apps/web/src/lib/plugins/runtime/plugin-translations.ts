import { supportedLocales } from "@i18n/resources";
import type { Translations } from "@kaneo/plugin-sdk/web";
import i18n from "i18next";

export function pluginNamespace(pluginId: string): string {
  return `plugin-${pluginId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function languageOf(locale: string): string {
  return locale.toLowerCase().split("-")[0] ?? "";
}

export function translationBundles(
  translations: Translations,
  locales: readonly string[],
): Array<[string, Record<string, unknown>]> {
  const entries = Object.entries(translations).filter(
    (entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]),
  );
  const bundles = new Map<string, Record<string, unknown>>();

  for (const [key, resources] of entries) {
    const exact = locales.find(
      (locale) => locale.toLowerCase() === key.toLowerCase(),
    );
    bundles.set(exact ?? key, resources);
  }

  for (const [key, resources] of entries) {
    if (key.includes("-")) continue;
    for (const locale of locales) {
      if (languageOf(locale) === key.toLowerCase() && !bundles.has(locale)) {
        bundles.set(locale, resources);
      }
    }
  }

  return [...bundles.entries()];
}

export function registerPluginTranslations(
  pluginId: string,
  translations: Translations,
): void {
  const namespace = pluginNamespace(pluginId);
  for (const [locale, resources] of translationBundles(
    translations,
    supportedLocales,
  )) {
    i18n.addResourceBundle(locale, namespace, resources, true, true);
  }
}
