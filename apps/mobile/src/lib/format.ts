import { currentLocale, i18n } from "@/lib/i18n";

/** A calendar day without a time, as year/month(0-based)/day. */
export type Day = { y: number; m: number; d: number };

export function parseInstant(value?: string | null): Date | null {
  if (!value) return null;
  // `new Date("2026-03-09")` is UTC midnight, which is the previous day west of UTC.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (bare)
    return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDay(date: Date): Day {
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
}

export function parseDay(value?: string | null): Day | null {
  const instant = parseInstant(value);
  return instant ? toDay(instant) : null;
}

export function today(): Day {
  return toDay(new Date());
}

export function dayToDate(day: Day): Date {
  return new Date(day.y, day.m, day.d);
}

export function addDays(day: Day, n: number): Day {
  return toDay(new Date(day.y, day.m, day.d + n));
}

export function compareDays(a: Day, b: Day): number {
  return dayToDate(a).getTime() - dayToDate(b).getTime();
}

export function sameDay(a: Day | null, b: Day | null): boolean {
  return !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
}

/** Kaneo stores calendar dates as the instant of local midnight, like the web app's `Date#toISOString()`. */
export function toApiDate(day: Day): string {
  return dayToDate(day).toISOString();
}

/** `YYYY-MM-DD`, used for custom date fields. */
export function toIsoDay(day: Day): string {
  return `${day.y}-${String(day.m + 1).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
}

export function monthName(m: number, long = false) {
  return new Intl.DateTimeFormat(currentLocale(), {
    month: long ? "long" : "short",
  }).format(new Date(2026, m, 1));
}

export function formatDay(day: Day): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    month: "short",
    day: "numeric",
    ...(day.y === new Date().getFullYear() ? {} : { year: "numeric" as const }),
  }).format(dayToDate(day));
}

export function formatDate(value?: string | null): string {
  const day = parseDay(value);
  return day ? formatDay(day) : "";
}

/** "Today", "Tomorrow", "Sun, Oct 4" within a week, otherwise "Oct 14". */
export function formatDueShort(value?: string | null): string {
  const day = parseDay(value);
  if (!day) return "";
  const diff = Math.round(compareDays(day, today()) / 86_400_000);
  if (diff === 0) return i18n.t("mobile:time.today");
  if (diff === 1) return i18n.t("mobile:time.tomorrow");
  if (diff > 1 && diff < 7)
    return new Intl.DateTimeFormat(currentLocale(), {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(dayToDate(day));
  return formatDay(day);
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string | null): string {
  const date = parseInstant(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(currentLocale(), {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" as const }),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function isOverdue(value?: string | null): boolean {
  const day = parseDay(value);
  return !!day && compareDays(day, today()) < 0;
}

/** Whole days a due date is late by, or 0. */
export function daysOverdue(value?: string | null): number {
  const day = parseDay(value);
  if (!day) return 0;
  return Math.max(0, Math.round(compareDays(today(), day) / 86_400_000));
}

/** Compact relative time: "12m", "3h", "Yesterday", "Tue", "Oct 2". */
export function relativeShort(value?: string | null): string {
  const date = parseInstant(value);
  if (!date) return "";
  const now = Date.now();
  const seconds = Math.max(0, (now - date.getTime()) / 1000);
  if (seconds < 60) return i18n.t("mobile:time.now");
  if (seconds < 3600)
    return i18n.t("mobile:time.minutesShort", {
      count: Math.floor(seconds / 60),
    });
  const day = toDay(date);
  const diffDays = Math.round(compareDays(today(), day) / 86_400_000);
  if (diffDays === 0)
    return i18n.t("mobile:time.hoursShort", {
      count: Math.floor(seconds / 3600),
    });
  if (diffDays === 1) return i18n.t("mobile:time.yesterday");
  if (diffDays < 7)
    return new Intl.DateTimeFormat(currentLocale(), {
      weekday: "short",
    }).format(date);
  return formatDay(day);
}

/** "12 min ago", "3 hr ago", "Yesterday", "Oct 2"; `ago: false` gives "12 min", "3 hr". */
export function relativeLong(
  value?: string | null,
  { ago = true }: { ago?: boolean } = {},
): string {
  const date = parseInstant(value);
  if (!date) return "";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return i18n.t("mobile:time.justNow");
  if (seconds < 3600)
    return ago
      ? i18n.t("mobile:time.minutesAgo", { count: Math.floor(seconds / 60) })
      : i18n.t("mobile:time.minutes", { count: Math.floor(seconds / 60) });
  const diffDays = Math.round(compareDays(today(), toDay(date)) / 86_400_000);
  if (diffDays === 0)
    return ago
      ? i18n.t("mobile:time.hoursAgo", { count: Math.floor(seconds / 3600) })
      : i18n.t("mobile:time.hours", { count: Math.floor(seconds / 3600) });
  if (diffDays === 1) return i18n.t("mobile:time.yesterday");
  return formatDay(toDay(date));
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0)
    return m > 0
      ? i18n.t("mobile:time.durationHoursMinutes", { hours: h, minutes: m })
      : i18n.t("mobile:time.hoursShort", { count: h });
  if (m > 0) return i18n.t("mobile:time.minutesShort", { count: m });
  return i18n.t("mobile:time.secondsShort", { count: s });
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function ticketId(
  projectSlug?: string | null,
  number?: number | null,
): string {
  if (number === null || number === undefined) return "";
  return projectSlug ? `${projectSlug.toUpperCase()}-${number}` : `#${number}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Project keys in Kaneo are short uppercase prefixes used in ticket ids (e.g. KAN-12). */
export function suggestProjectKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const key =
    words.length > 1 ? words.map((w) => w[0]).join("") : name.slice(0, 3);
  return (
    key
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5) || "PRJ"
  );
}

export function initials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return i18n.t("mobile:time.goodEvening");
  if (h < 12) return i18n.t("mobile:time.goodMorning");
  if (h < 18) return i18n.t("mobile:time.goodAfternoon");
  return i18n.t("mobile:time.goodEvening");
}
