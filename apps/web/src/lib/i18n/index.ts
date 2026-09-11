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

const I18N_CHUNK_RELOAD_FLAG = "i18n_chunk_reload_attempted";

function loadLocaleResources(
  locale: AppLocale,
): Promise<Record<string, unknown>> {
  const cached = localeResources.get(locale);
  if (cached) return cached;
  const pending = loadLocale(locale)
    .then((resources) => {
      // Successful load — clear the reload flag so a stale-chunk failure
      // from a later deployment in the same tab can still trigger a reload.
      try {
        sessionStorage.removeItem(I18N_CHUNK_RELOAD_FLAG);
      } catch {
        // sessionStorage unavailable — nothing to clear.
      }
      return resources as Record<string, unknown>;
    })
    .catch((err: unknown) => {
      // Remove the rejected promise from cache so a subsequent call can retry.
      localeResources.delete(locale);

      // A dynamic import failure typically means the browser has a stale
      // version of the app (cached HTML referencing old content-hashed chunks)
      // and the asset no longer exists after a new deployment. Reloading
      // fetches the latest HTML and chunk filenames.
      // Chrome: "Failed to fetch dynamically imported module"
      // Firefox: "error loading dynamically imported module"
      const isStaleChunk =
        err instanceof TypeError &&
        (err.message.includes("Failed to fetch dynamically imported module") ||
          err.message.includes("error loading dynamically imported module"));

      if (isStaleChunk) {
        try {
          if (!sessionStorage.getItem(I18N_CHUNK_RELOAD_FLAG)) {
            sessionStorage.setItem(I18N_CHUNK_RELOAD_FLAG, "1");
            window.location.reload();
            // Return a never-resolving promise so callers wait for the reload
            // rather than receiving a rejected promise.
            return new Promise<never>(() => {});
          }
          // Already reloaded once — fail silently so we don't loop.
          return Promise.reject(err);
        } catch {
          // sessionStorage access failed (disabled, private browsing, quota, etc.)
          // Skip reload attempt and rethrow the original error.
        }
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
