import {
  type AppLocale,
  defaultLocale,
  resources,
  supportedLocales,
} from "@i18n/resources";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

function getLanguageCode(locale: string) {
  return locale.toLowerCase().split("-")[0];
}

export function resolveLocale(
  preferredLocale?: string | null,
  browserLocale?: string | null,
): AppLocale {
  const candidates = [preferredLocale, browserLocale]
    .filter(Boolean)
    .map((value) => value?.toLowerCase());

  for (const candidate of candidates) {
    if (!candidate) continue;
    const exactMatch = supportedLocales.find((locale) => locale === candidate);
    if (exactMatch) return exactMatch;

    const languageMatch = supportedLocales.find(
      (locale) => getLanguageCode(locale) === getLanguageCode(candidate),
    );
    if (languageMatch) return languageMatch;
  }

  return defaultLocale;
}

export function getBrowserLocale(): string | null {
  if (typeof navigator === "undefined") return null;
  return navigator.language || navigator.languages?.[0] || null;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLocale(null, getBrowserLocale()),
  fallbackLng: defaultLocale,
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
