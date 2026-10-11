const supportedLocales = ["en", "de", "vi", "ja", "zh-tw"] as const;

export type EmailLocale = (typeof supportedLocales)[number];

const defaultLocale: EmailLocale = "en";

const htmlLangs: Record<EmailLocale, string> = {
  en: "en",
  de: "de",
  vi: "vi",
  ja: "ja",
  "zh-tw": "zh-TW",
};

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

export function emailHtmlLang(locale: EmailLocale): string {
  return htmlLangs[locale];
}
