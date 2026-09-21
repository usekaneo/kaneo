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

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}

/** Exact tracked-time label for tooltips: `h:mm:ss`. */
export function formatDurationExact(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${hours}:${pad(minutes)}:${pad(rest)}`;
}

/**
 * Entry range label: `Sat, Sep 19, 3:44 pm - 3:44 pm CEST (UTC+2)`.
 * The trailing zone combines the short name with the numeric offset.
 */
export function formatEntryRange(
  start: Date | string | number,
  end: Date | string | number,
  locale?: string,
) {
  const language = getLocale(locale);
  const startDate = toDate(start);
  const endDate = toDate(end);
  const day = new Intl.DateTimeFormat(language, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(startDate);
  const time = new Intl.DateTimeFormat(language, {
    hour: "numeric",
    minute: "2-digit",
  });
  const zoneName = new Intl.DateTimeFormat(language, {
    timeZoneName: "short",
  })
    .formatToParts(startDate)
    .find((part) => part.type === "timeZoneName")?.value;
  const zoneOffset = new Intl.DateTimeFormat(language, {
    timeZoneName: "shortOffset",
  })
    .formatToParts(startDate)
    .find((part) => part.type === "timeZoneName")?.value;
  // Some zones render identically in both styles (`GMT+2` and `GMT+2`).
  const zone =
    zoneName && zoneOffset && zoneName !== zoneOffset
      ? `${zoneName} (${zoneOffset})`
      : (zoneName ?? (zoneOffset ? `(${zoneOffset})` : ""));
  return `${day}, ${time.format(startDate)} - ${time.format(endDate)}${zone ? ` ${zone}` : ""}`;
}

const DURATION_UNITS: Record<string, number> = {
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
};

/**
 * Parse a human duration like `1h 30m 5s` (tokens combinable in any order).
 * A bare number means minutes. Day units are deliberately unsupported and
 * reject the input. Returns whole seconds, or null when nothing parseable
 * was entered.
 */
export function parseDurationString(value: string) {
  const input = value.trim().toLowerCase();
  if (!input) return null;

  const tokenPattern = /(\d+(?:\.\d+)?)\s*([a-z]+)?/g;
  let total = 0;
  let matched = false;

  for (const match of input.matchAll(tokenPattern)) {
    const amount = Number(match[1]);
    const unit = (match[2] ?? "m").toLowerCase();
    const multiplier = DURATION_UNITS[unit];
    if (!Number.isFinite(amount) || multiplier === undefined) {
      return null;
    }
    total += amount * multiplier;
    matched = true;
  }

  // Reject trailing garbage (`1h xyz`). Only whitespace may remain.
  const remainder = input.replace(tokenPattern, "").trim();
  if (!matched || remainder !== "") {
    return null;
  }

  return Math.round(total);
}

/** Short live elapsed label: `mm:ss`, switching to `h:mm:ss` past an hour. */
export function formatElapsed(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(minutes)}:${pad(rest)}`;
  }
  return formatDurationExact(seconds);
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
