const defaultSupportedLocales = ["en", "de"] as const;

type EmailLocale = (typeof defaultSupportedLocales)[number];

export function resolveEmailLocale(locale?: string | null): EmailLocale;
export function resolveEmailLocale<
  const SupportedLocales extends readonly [string, ...string[]],
>(
  locale: string | null | undefined,
  supportedLocales: SupportedLocales,
): SupportedLocales[number];
export function resolveEmailLocale(
  locale?: string | null,
  supportedLocales: readonly string[] = defaultSupportedLocales,
): string {
  const defaultLocale = supportedLocales[0] ?? "en";
  if (!locale) return defaultLocale;

  const normalized = locale.toLowerCase();

  const exact = supportedLocales.find((l) => l === normalized);
  if (exact) return exact;

  const languageCode = normalized.split("-")[0];
  const match = supportedLocales.find((l) => l === languageCode);
  if (match) return match;

  return defaultLocale;
}
