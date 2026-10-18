// Mirrors i18n/resources.ts, which lies outside this package's rootDir.
export const SUPPORTED_LOCALES = [
  "az-AZ",
  "mk-MK",
  "nl-NL",
  "de-DE",
  "el-GR",
  "en-US",
  "es-ES",
  "fr-FR",
  "hi-IN",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "pl-PL",
  "pt-BR",
  "ru-RU",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "zh-CN",
  "zh-TW",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function getLanguageCode(locale: string) {
  return locale.toLowerCase().split("-")[0];
}

function getScript(locale: string) {
  try {
    return new Intl.Locale(locale).maximize().script;
  } catch {
    return undefined;
  }
}

export function resolveSupportedLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().replaceAll("_", "-").toLowerCase();
  if (!candidate) return null;
  return (
    SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === candidate) ??
    SUPPORTED_LOCALES.find(
      (locale) =>
        getLanguageCode(locale) === getLanguageCode(candidate) &&
        getScript(locale) === getScript(candidate),
    ) ??
    SUPPORTED_LOCALES.find(
      (locale) => getLanguageCode(locale) === getLanguageCode(candidate),
    ) ??
    null
  );
}
