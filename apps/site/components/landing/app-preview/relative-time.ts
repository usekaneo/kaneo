const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

// Same output as apps/web's formatRelativeTime: "12 minutes ago", "yesterday".
export function formatRelativeTime(value: string, now = new Date()) {
  const diffSeconds = Math.round(
    (new Date(value).getTime() - now.getTime()) / 1000,
  );
  const [unit, unitSeconds] =
    UNITS.find(([, seconds]) => Math.abs(diffSeconds) >= seconds) ??
    UNITS[UNITS.length - 1];
  return formatter.format(Math.round(diffSeconds / unitSeconds), unit);
}
