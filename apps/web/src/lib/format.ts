import { i18n } from "./i18n";

type DateInput = Date | string | number;

function toDate(input: DateInput) {
  return input instanceof Date ? input : new Date(input);
}

function getLocale(locale?: string) {
  return locale || i18n.resolvedLanguage || i18n.language || "en-US";
}

// Constructing an Intl.DateTimeFormat is comparatively expensive, and these
// helpers run per task on task-heavy boards and realtime views. Cache one
// formatter per locale+options combination so re-renders reuse it.
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const key = `${locale}|${options ? JSON.stringify(options) : ""}`;
  let formatter = dateFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatterCache.set(key, formatter);
  }
  return formatter;
}

export function formatDate(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
) {
  return getDateFormatter(getLocale(locale), options).format(toDate(value));
}

export function formatDateShort(value: DateInput, locale?: string) {
  return formatDate(
    value,
    {
      month: "short",
      day: "numeric",
    },
    locale,
  );
}

export function formatDateMedium(value: DateInput, locale?: string) {
  return formatDate(
    value,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
    locale,
  );
}

/** Locale-aware full date and time (for tooltips next to relative labels like "yesterday"). */
export function formatDateTime(value: DateInput, locale?: string) {
  return formatDate(
    value,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
    locale,
  );
}

const relativeTimeFormatterCache = new Map<string, Intl.RelativeTimeFormat>();

function getRelativeTimeFormatter(locale: string) {
  let formatter = relativeTimeFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeTimeFormatterCache.set(locale, formatter);
  }
  return formatter;
}

export function formatRelativeTime(
  value: DateInput,
  locale?: string,
  now = new Date(),
) {
  const target = toDate(value);
  const diffMs = target.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  const formatter = getRelativeTimeFormatter(getLocale(locale));

  for (const [unit, unitSeconds] of units) {
    if (absSeconds >= unitSeconds || unit === "second") {
      return formatter.format(Math.round(diffSeconds / unitSeconds), unit);
    }
  }

  return formatter.format(0, "second");
}
