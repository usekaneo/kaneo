import {
  type AppLocale,
  defaultLocale,
  isSupportedLocale,
  loadLocale,
  supportedLocales,
} from "@i18n/resources";
import i18n from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

function getLanguageCode(locale: string) {
  return locale.toLowerCase().split("-")[0];
}

export function resolveLocale(
  preferredLocale?: string | null,
  browserLocale?: string | null,
): AppLocale {
  const candidates = [preferredLocale, browserLocale].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase();
    const exactMatch = supportedLocales.find(
      (locale) => locale.toLowerCase() === normalizedCandidate,
    );
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

// Components subscribe to the default namespace only, so any other namespace
// they reference through `t("ns:key")` must be preloaded after init and on
// every locale change. The lazy backend already returns the whole locale JSON,
// so cache it once per locale to avoid a fresh dynamic import per namespace.
const localeResources = new Map<AppLocale, Promise<Record<string, unknown>>>();

// One flag per locale so a successful load of the default locale does not
// clear the guard for a different locale that is still failing.
function reloadFlagKey(locale: AppLocale) {
  return `locale-chunk-reload:${locale}`;
}

function getReloadFlag(locale: AppLocale): boolean {
  try {
    return sessionStorage.getItem(reloadFlagKey(locale)) === "1";
  } catch {
    return false;
  }
}

function setReloadFlag(locale: AppLocale): void {
  try {
    sessionStorage.setItem(reloadFlagKey(locale), "1");
  } catch {
    // sessionStorage unavailable — skip; reload guard will not work but that
    // is safer than not reloading at all.
  }
}

function clearReloadFlag(locale: AppLocale): void {
  try {
    sessionStorage.removeItem(reloadFlagKey(locale));
  } catch {
    // sessionStorage unavailable — nothing to clear.
  }
}

function loadLocaleResources(
  locale: AppLocale,
): Promise<Record<string, unknown>> {
  const cached = localeResources.get(locale);
  if (cached) return cached;
  const pending = loadLocale(locale)
    .then((resources) => {
      // Successful load — clear the per-locale reload guard so a future
      // stale-chunk failure in this same tab can still recover.
      clearReloadFlag(locale);
      return resources as Record<string, unknown>;
    })
    .catch((err: unknown) => {
      // Evict the failed promise so future attempts are not permanently stuck.
      localeResources.delete(locale);

      // Only reload for recognised dynamic-import fetch failures (stale
      // deployment). Network interruptions and other errors cannot be fixed
      // by loading a newer bundle, so rethrow them without reloading.
      if (
        err instanceof TypeError &&
        err.message.includes("Failed to fetch dynamically imported module")
      ) {
        if (!getReloadFlag(locale)) {
          setReloadFlag(locale);
          window.location.reload();
          // Return a never-resolving promise so callers wait for the reload
          // rather than receiving a rejected promise.
          return new Promise<never>(() => {});
        }
        // Already reloaded once for this locale — fail without looping.
      }

      throw err;
    });
  localeResources.set(locale, pending);
  return pending;
}

export function preloadNamespaces(locale: AppLocale): Promise<void> {
  return loadLocaleResources(locale).then((resources) =>
    i18n.loadNamespaces(Object.keys(resources)),
  );
}

const initialLocale = resolveLocale(null, getBrowserLocale());

void i18n
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      const locale = isSupportedLocale(language) ? language : defaultLocale;
      return loadLocaleResources(locale).then(
        (resources) => resources[namespace],
      );
    }),
  )
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: defaultLocale,
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
  })
  .then(() => preloadNamespaces(initialLocale));

export { i18n };
