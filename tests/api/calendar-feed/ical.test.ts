import { describe, expect, it } from "vitest";
import { buildCalendar } from "../../../apps/api/src/calendar-feed/ical";

const task: Parameters<typeof buildCalendar>[0]["tasks"][number] = {
  id: "task-1",
  title: "Deploy",
  description: null,
  startDate: null,
  dueDate: new Date("2026-09-23T00:00:00Z"),
  createdAt: new Date("2026-09-01T12:00:00Z"),
  updatedAt: new Date("2026-09-22T10:30:00Z"),
};
const calendar = (tasks = [task], timeZone = "UTC") =>
  buildCalendar({ name: "Changes", timeZone, tasks });

describe("iCalendar serialization", () => {
  it("exports an inclusive all-day range with stable identity and revision timestamps", () => {
    const result = calendar([
      { ...task, startDate: new Date("2026-09-21T00:00:00Z") },
    ]);
    expect(result).toContain("UID:task-1@kaneo\r\n");
    expect(result).toContain(
      "DTSTART;VALUE=DATE:20260921\r\nDTEND;VALUE=DATE:20260924",
    );
    expect(result).toContain("DTSTAMP:20260922T103000Z");
    expect(result).toContain("LAST-MODIFIED:20260922T103000Z");
    expect(result).toBe(
      calendar([{ ...task, startDate: new Date("2026-09-21T00:00:00Z") }]),
    );
  });

  it("handles due-only, start-only, unscheduled, and reversed legacy dates", () => {
    expect(calendar()).toContain(
      "DTSTART;VALUE=DATE:20260923\r\nDTEND;VALUE=DATE:20260924",
    );
    expect(
      calendar([{ ...task, dueDate: null, startDate: task.dueDate }]),
    ).toContain("DTEND;VALUE=DATE:20260924");
    expect(calendar([{ ...task, dueDate: null }])).not.toContain(
      "BEGIN:VEVENT",
    );
    expect(
      calendar([{ ...task, startDate: new Date("2026-09-30T00:00:00Z") }]),
    ).toContain("DTEND;VALUE=DATE:20261001");
  });

  it("keeps local dates across UTC offsets and daylight saving changes", () => {
    const result = calendar(
      [
        {
          ...task,
          startDate: new Date("2026-10-24T22:00:00Z"),
          dueDate: new Date("2026-10-25T23:00:00Z"),
        },
      ],
      "Europe/Berlin",
    );
    expect(result).toContain(
      "DTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261027",
    );
    expect(
      calendar(
        [{ ...task, dueDate: new Date("2026-01-01T02:00:00Z") }],
        "America/Los_Angeles",
      ),
    ).toContain("DTSTART;VALUE=DATE:20251231\r\nDTEND;VALUE=DATE:20260101");
  });

  it("escapes text and prevents newlines from injecting calendar properties", () => {
    const result = buildCalendar({
      name: "Changes, ops; team",
      timeZone: "UTC",
      tasks: [
        {
          ...task,
          title: "A\\B, C; D\r\nEND:VEVENT",
          description: "First\rSecond\nThird",
        },
      ],
    });
    expect(result).toContain("X-WR-CALNAME:Changes\\, ops\\; team");
    expect(result).toContain("SUMMARY:A\\\\B\\, C\\; D\\nEND:VEVENT\r\n");
    expect(result).toContain("DESCRIPTION:First\\nSecond\\nThird");
    expect(result.match(/\r\nEND:VEVENT/g)).toHaveLength(1);
  });

  it("folds at 75 UTF-8 octets without splitting characters and uses CRLF", () => {
    const title = "Änderung 日本語 🚀 ".repeat(20);
    const result = calendar([{ ...task, title }]);
    for (const line of result.split("\r\n"))
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(result.replaceAll("\r\n ", "")).toContain(`SUMMARY:${title}\r\n`);
    expect(result.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    expect(result.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
