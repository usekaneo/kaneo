const supportedLocales = ["en", "de"] as const;

type EmailLocale = (typeof supportedLocales)[number];

const defaultLocale: EmailLocale = "en";

export function resolveEmailLocale(locale?: string | null): EmailLocale {
  if (!locale) return defaultLocale;

  const normalized = locale.toLowerCase();

  const exact = supportedLocales.find((l) => l === normalized);
  if (exact) return exact;

  const languageCode = normalized.split("-")[0];
  const match = supportedLocales.find((l) => l === languageCode);
  if (match) return match;

  return defaultLocale;
}
