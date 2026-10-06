import { type AppLocale, supportedLocales } from "@i18n/resources";

export function getLocaleLabel(locale: AppLocale) {
  try {
    const localeObj = new Intl.Locale(locale);
    const languageDisplayNames = new Intl.DisplayNames([locale], {
      type: "language",
    });
    const sharesLanguage =
      supportedLocales.filter((supportedLocale) =>
        supportedLocale.startsWith(`${localeObj.language}-`),
      ).length > 1;
    return (
      languageDisplayNames.of(sharesLanguage ? locale : localeObj.language) ??
      locale
    );
  } catch {
    return locale;
  }
}
