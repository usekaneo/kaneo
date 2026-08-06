import { describe, expect, it } from "vitest";
import { getDueDateStatus, isTaskCompleted } from "./due-date-status";

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const NEXT_MONTH = new Date(
  Date.now() + 30 * 24 * 60 * 60 * 1000,
).toISOString();

describe("getDueDateStatus", () => {
  it("flags overdue and due-soon dates for open tasks", () => {
    expect(getDueDateStatus(YESTERDAY)).toBe("overdue");
    expect(getDueDateStatus(TOMORROW)).toBe("due-soon");
    expect(getDueDateStatus(NEXT_MONTH)).toBe("far-future");
    expect(getDueDateStatus(null)).toBe("no-due-date");
  });

  it("never warns about a completed task, however overdue", () => {
    expect(getDueDateStatus(YESTERDAY, true)).toBe("far-future");
    expect(getDueDateStatus(TOMORROW, true)).toBe("far-future");
  });
});

describe("isTaskCompleted", () => {
  const columns = [
    { slug: "to-do", isFinal: false },
    { slug: "shipped", isFinal: true },
  ];

  it("uses the column isFinal flag when columns are available", () => {
    expect(isTaskCompleted("shipped", columns)).toBe(true);
    expect(isTaskCompleted("to-do", columns)).toBe(false);
  });

  it("does not assume a column named done is final", () => {
    expect(isTaskCompleted("done", [{ slug: "done", isFinal: false }])).toBe(
      false,
    );
  });

  it("falls back to the slug when columns are not loaded", () => {
    expect(isTaskCompleted("done")).toBe(true);
    expect(isTaskCompleted("archived")).toBe(true);
    expect(isTaskCompleted("in-progress")).toBe(false);
    expect(isTaskCompleted("done", [])).toBe(true);
  });
});
