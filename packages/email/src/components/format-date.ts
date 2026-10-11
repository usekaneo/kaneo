export type DateInput = Date | string;

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(
  value: DateInput,
  lang: string,
  options: Intl.DateTimeFormatOptions,
): string | undefined {
  const date = toDate(value);
  if (!date) return undefined;
  return new Intl.DateTimeFormat(lang, { ...options, timeZone: "UTC" }).format(
    date,
  );
}

export function formatDateTime(value: DateInput, lang: string) {
  return format(value, lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatDate(value: DateInput, lang: string) {
  return format(value, lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatShortDate(value: DateInput, lang: string) {
  return format(value, lang, { month: "short", day: "numeric" });
}
