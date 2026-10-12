import { describe, expect, it } from "vite-plus/test";
import {
  getInitials,
  resolveColumnIcon,
  resolveDueStatus,
  resolveLabelColor,
  resolvePriority,
} from "./email-task-format";

describe("email task format", () => {
  it("maps label color names and keeps hex values", () => {
    expect(resolveLabelColor("purple")).toBe("#8E51FF");
    expect(resolveLabelColor("#123abc")).toBe("#123abc");
    expect(resolveLabelColor("var(--x)")).toBe("#A1A1A1");
  });

  it("uses the column icon, then the default for its slug", () => {
    expect(
      resolveColumnIcon({ slug: "x", icon: "CircleDot", isFinal: false }),
    ).toBe("circle-dot");
    expect(
      resolveColumnIcon({ slug: "in-review", icon: null, isFinal: false }),
    ).toBe("search");
    expect(
      resolveColumnIcon({ slug: "custom", icon: "Rocket", isFinal: true }),
    ).toBe("check-circle");
  });

  it("drops tasks without a priority", () => {
    expect(resolvePriority("high")).toBe("high");
    expect(resolvePriority("no-priority")).toBeUndefined();
    expect(resolvePriority(null)).toBeUndefined();
  });

  it("matches the board's due date thresholds", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    expect(resolveDueStatus(new Date("2026-10-10T12:00:00Z"), false, now)).toBe(
      "overdue",
    );
    expect(resolveDueStatus(new Date("2026-10-14T12:00:00Z"), false, now)).toBe(
      "due-soon",
    );
    expect(resolveDueStatus(new Date("2026-10-20T12:00:00Z"), false, now)).toBe(
      "far-future",
    );
    expect(resolveDueStatus(new Date("2026-10-10T12:00:00Z"), true, now)).toBe(
      "far-future",
    );
  });

  it("builds initials like the web app", () => {
    expect(getInitials("Maya Kim")).toBe("MK");
    expect(getInitials("maya")).toBe("MA");
    expect(getInitials("  ")).toBeUndefined();
  });
});
