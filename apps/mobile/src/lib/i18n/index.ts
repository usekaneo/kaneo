// i18next plurals need Intl.PluralRules, which Hermes may lack; this installs only when missing.
import "intl-pluralrules";
import en from "@i18n/en-US.json";
import { defaultLocale, loadLocale } from "@i18n/resources";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resolveLocale } from "./resolve-locale";

// English is bundled so the first frame already has copy; the device's locale loads before the
// splash screen hides.
void i18n.use(initReactI18next).init({
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  resources: { [defaultLocale]: en },
  ns: Object.keys(en),
  defaultNS: "mobile",
  interpolation: { escapeValue: false },
  initAsync: false,
});

function deviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

export async function loadDeviceLocale(): Promise<void> {
  const locale = resolveLocale([deviceLocale()]);
  if (locale === i18n.language) return;
  try {
    const catalog = (await loadLocale(locale)) as Record<string, object>;
    for (const [ns, resources] of Object.entries(catalog))
      i18n.addResourceBundle(locale, ns, resources, true, true);
    await i18n.changeLanguage(locale);
  } catch {
    // Keep English if the catalog can't load.
  }
}

/** The active locale, for `Intl` date and number formatting. */
export function currentLocale(): string {
  return i18n.language || defaultLocale;
}

export { i18n };
