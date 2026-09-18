// Show and enter attendance times in the workspace timezone, which may
// differ from the browser's.

function parts(instant: Date, timeZone: string) {
  const out = new Intl.DateTimeFormat("en-US", {
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
    Number(out.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "10:02" in the zone. */
export function zonedClock(instant: Date | string, timeZone: string) {
  const p = parts(new Date(instant), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "YYYY-MM-DD" in the zone. */
export function zonedDay(instant: Date | string, timeZone: string) {
  const p = parts(new Date(instant), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The instant of a wall-clock day + "HH:MM" in the zone. */
export function zonedInstant(day: string, time: string, timeZone: string) {
  const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (at: number) => {
    const p = parts(new Date(at), timeZone);
    return (
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
      Math.floor(at / 1000) * 1000
    );
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}

export function addDaysToDay(day: string, amount: number) {
  const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + amount)).toISOString().slice(0, 10);
}
