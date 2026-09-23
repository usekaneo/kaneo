type CalendarTask = {
  id: string;
  title: string;
  description: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

// RFC 5545 limits physical lines to 75 octets, including continuation spaces.
function foldLine(line: string) {
  const lines: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      lines.push(current);
      current = " ";
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  lines.push(current);
  return lines.join("\r\n");
}

function timestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function calendarDate(date: Date, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("");
}

function nextDay(date: string) {
  const day = new Date(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`,
  );
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10).replaceAll("-", "");
}

export function buildCalendar({
  name,
  timeZone,
  tasks,
}: {
  name: string;
  timeZone: string;
  tasks: CalendarTask[];
}) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kaneo//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const task of tasks) {
    const scheduledDate = task.startDate ?? task.dueDate;
    if (!scheduledDate) continue;
    const start = calendarDate(scheduledDate, formatter);
    const due = calendarDate(task.dueDate ?? scheduledDate, formatter);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@kaneo`,
      `DTSTAMP:${timestamp(task.updatedAt)}`,
      `CREATED:${timestamp(task.createdAt)}`,
      `LAST-MODIFIED:${timestamp(task.updatedAt)}`,
      `DTSTART;VALUE=DATE:${start}`,
      // Task due dates are inclusive; iCalendar's DTEND is exclusive.
      `DTEND;VALUE=DATE:${nextDay(due < start ? start : due)}`,
      `SUMMARY:${escapeText(task.title)}`,
      ...(task.description
        ? [`DESCRIPTION:${escapeText(task.description)}`]
        : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
