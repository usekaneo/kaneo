import type { AppLocale } from "@i18n/resources";

const STORAGE_KEY = "kaneo:locale";

/**
 * Persists the resolved locale to localStorage so the bootstrap script in
 * index.html can set the correct dir/lang before React mounts.
 *
 * This prevents an LTR→RTL (or RTL→LTR) layout jump when the user's saved
 * locale differs from their browser language.
 */
export function persistLocale(locale: AppLocale) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private browsing or quota exceeded; ignore.
  }
}

/**
 * Reads the persisted locale from localStorage, if available. Used by the
 * bootstrap script in index.html to set the initial direction.
 */
export function readPersistedLocale(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
