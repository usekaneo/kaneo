import {
  type AppLocale,
  defaultLocale,
  supportedLocales,
} from "@i18n/resources";

function languageCode(locale: string) {
  return locale.toLowerCase().split(/[-_]/)[0];
}

// Chinese splits by script, not region: iOS reports `zh-Hant-TW` or `zh-HK`, which must not fall
// through to the first Chinese catalog (Simplified).
function chineseCatalog(locale: string): AppLocale | null {
  if (languageCode(locale) !== "zh") return null;
  return /-(hant|tw|hk|mo)\b/.test(locale) ? "zh-TW" : "zh-CN";
}

/** Picks the first candidate Kaneo has a catalog for, matching the region first, then the language. */
export function resolveLocale(
  candidates: (string | null | undefined)[],
): AppLocale {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.replaceAll("_", "-").toLowerCase();
    const chinese = chineseCatalog(normalized);
    if (chinese) return chinese;
    const exact = supportedLocales.find((l) => l.toLowerCase() === normalized);
    if (exact) return exact;
    const language = supportedLocales.find(
      (l) => languageCode(l) === languageCode(candidate),
    );
    if (language) return language;
  }
  return defaultLocale;
}
