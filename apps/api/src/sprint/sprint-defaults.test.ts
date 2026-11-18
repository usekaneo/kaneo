import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_SPRINT_LENGTH_DAYS,
  deriveSprintEndDate,
  nextSprintName,
} from "./sprint-defaults";

describe("deriveSprintEndDate", () => {
  it("adds the project's default sprint length in days", () => {
    const start = new Date("2025-01-15T00:00:00.000Z");
    const end = deriveSprintEndDate(start, 14);
    expect(end.toISOString()).toBe("2025-01-29T00:00:00.000Z");
  });

  it("does not mutate the given start date", () => {
    const start = new Date("2025-01-15T00:00:00.000Z");
    deriveSprintEndDate(start, 30);
    expect(start.toISOString()).toBe("2025-01-15T00:00:00.000Z");
  });

  it("falls back to at least one day", () => {
    const end = deriveSprintEndDate(new Date("2025-06-01T00:00:00.000Z"), 0);
    expect(end.toISOString()).toBe("2025-06-02T00:00:00.000Z");
  });

  it("exposes the shipped default sprint length", () => {
    expect(DEFAULT_SPRINT_LENGTH_DAYS).toBe(14);
  });
});

describe("nextSprintName", () => {
  it("numbers the first sprint of a project", () => {
    expect(nextSprintName([])).toBe("Sprint 1");
  });

  it("continues after the existing sprints", () => {
    expect(nextSprintName(["Sprint 1", "Sprint 2"])).toBe("Sprint 3");
  });

  it("skips names that are already taken, including by closed sprints", () => {
    expect(nextSprintName(["Sprint 2", "Sprint 3"])).toBe("Sprint 4");
    expect(nextSprintName(["Sprint 1", "Sprint 2", "Sprint 4"])).toBe(
      "Sprint 5",
    );
  });

  it("ignores renamed sprints that no longer block a number", () => {
    expect(nextSprintName(["Launch", "Sprint 2"])).toBe("Sprint 1");
  });
});
