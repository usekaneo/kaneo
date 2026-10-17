import {
  type AppLocale,
  defaultLocale,
  supportedLocales,
} from "@i18n/resources";

function languageCode(locale: string) {
  return locale.toLowerCase().split(/[-_]/)[0];
}

/** Picks the first candidate Kaneo has a catalog for, matching the region first, then the language. */
export function resolveLocale(
  candidates: (string | null | undefined)[],
): AppLocale {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.replace("_", "-").toLowerCase();
    const exact = supportedLocales.find((l) => l.toLowerCase() === normalized);
    if (exact) return exact;
    const language = supportedLocales.find(
      (l) => languageCode(l) === languageCode(candidate),
    );
    if (language) return language;
  }
  return defaultLocale;
}
