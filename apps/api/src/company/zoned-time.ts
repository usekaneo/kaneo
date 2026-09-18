// Calendar math in a workspace timezone using only Intl, so "today" means the
// company's today regardless of where the server runs.

function splitDay(day: string) {
  const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
  return { y, m, d };
}

function splitTime(time: string) {
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  return { hh, mm };
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Milliseconds the zone is ahead of UTC at `instant`.
function offsetMs(instant: Date, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The local calendar day (YYYY-MM-DD) of `instant` in `timeZone`. */
export function zonedDay(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The instant a local wall-clock time (day + "HH:MM") happens in `timeZone`. */
export function zonedInstant(day: string, time: string, timeZone: string) {
  const { y, m, d } = splitDay(day);
  const { hh, mm } = splitTime(time);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset across a DST change.
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** [start, end) of a local day as instants. */
export function zonedDayRange(day: string, timeZone: string) {
  return {
    start: zonedInstant(day, "00:00", timeZone),
    end: zonedInstant(addDays(day, 1), "00:00", timeZone),
  };
}

export function addDays(day: string, amount: number) {
  const { y, m, d } = splitDay(day);
  const next = new Date(Date.UTC(y, m - 1, d + amount));
  return next.toISOString().slice(0, 10);
}

/** ISO weekday of a calendar day: 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: string) {
  const { y, m, d } = splitDay(day);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/** Monday of the week that contains `day`. */
export function weekStartDay(day: string) {
  return addDays(day, 1 - isoWeekday(day));
}

export function monthStartDay(day: string) {
  return `${day.slice(0, 7)}-01`;
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
