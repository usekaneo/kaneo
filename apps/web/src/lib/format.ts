import { i18n } from "./i18n";

type DateInput = Date | string | number;

function toDate(input: DateInput) {
  return input instanceof Date ? input : new Date(input);
}

function getLocale(locale?: string) {
  return locale || i18n.resolvedLanguage || i18n.language || "en-US";
}

export function formatDate(
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
) {
  return new Intl.DateTimeFormat(getLocale(locale), options).format(
    toDate(value),
  );
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

  const formatter = new Intl.RelativeTimeFormat(getLocale(locale), {
    numeric: "auto",
  });

  for (const [unit, unitSeconds] of units) {
    if (absSeconds >= unitSeconds || unit === "second") {
      return formatter.format(Math.round(diffSeconds / unitSeconds), unit);
    }
  }

  return formatter.format(0, "second");
}
