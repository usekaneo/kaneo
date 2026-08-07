import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDueDateStatus } from "./due-date-status";

describe("getDueDateStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not mark completed tasks as overdue", () => {
    const status = getDueDateStatus("2026-07-31T12:00:00Z", true);

    expect(status).toBe("far-future");
  });

  it("does not mark completed tasks as due soon", () => {
    const status = getDueDateStatus("2026-08-03T12:00:00Z", true);

    expect(status).toBe("far-future");
  });
});
