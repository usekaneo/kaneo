import { describe, expect, it } from "vite-plus/test";
import { calendarTaskTicket } from "./calendar-task-ticket";

describe("calendarTaskTicket", () => {
  it("prefers the task's own project slug", () => {
    expect(
      calendarTaskTicket({ number: 12, projectSlug: "WEB" }, "FALLBACK"),
    ).toBe("WEB-12");
  });

  it("falls back to the view-level project slug", () => {
    expect(calendarTaskTicket({ number: 3, projectSlug: null }, "KAN")).toBe(
      "KAN-3",
    );
  });

  it("returns undefined without a number or slug", () => {
    expect(
      calendarTaskTicket({ number: null, projectSlug: "WEB" }),
    ).toBeUndefined();
    expect(calendarTaskTicket({ number: 1 })).toBeUndefined();
  });
});
