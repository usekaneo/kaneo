import { describe, expect, it } from "vitest";
import {
  type CascadeEdge,
  type CascadeSchedule,
  computeDependencyCascade,
} from "./gantt-dependency-cascade";

function day(n: number): Date {
  // Whole UTC days from a fixed epoch, so deltas are easy to reason about in
  // each test without pulling in date-fns just for arithmetic.
  return new Date(Date.UTC(2026, 0, 1 + n));
}

function schedule(start: number, end: number): CascadeSchedule {
  return { start: day(start), end: day(end) };
}

describe("computeDependencyCascade", () => {
  it("is a no-op when no constraint is violated", () => {
    // A (0-2) blocks B (5-7) FS, 0 lag: B.start (5) already >= A.end (2).
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 2)],
      ["b", schedule(5, 7)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    expect(shifts.size).toBe(0);
  });

  it("pushes an FS dependent forward just enough to clear source.end + lag", () => {
    // A moved to (0-10), overlapping B's original (5-8). FS + 2 days lag:
    // B.start must be >= 10 + 2 = 12, so B shifts by 12 - 5 = 7 days.
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 2,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 10)],
      ["b", schedule(5, 8)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    expect(shifts.get("b")).toEqual(schedule(12, 15));
  });

  it("enforces SS: target.start >= source.start + lag", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "ss",
        lagDays: 1,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(10, 20)],
      ["b", schedule(5, 9)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    // B.start must be >= 10 + 1 = 11, delta = 11 - 5 = 6.
    expect(shifts.get("b")).toEqual(schedule(11, 15));
  });

  it("enforces FF: target.end >= source.end + lag", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "ff",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 10)],
      ["b", schedule(2, 6)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    // B.end must be >= 10, delta = 10 - 6 = 4.
    expect(shifts.get("b")).toEqual(schedule(6, 10));
  });

  it("enforces SF: target.end >= source.start + lag", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "sf",
        lagDays: 3,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(10, 20)],
      ["b", schedule(0, 5)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    // B.end must be >= 10 + 3 = 13, delta = 13 - 5 = 8.
    expect(shifts.get("b")).toEqual(schedule(8, 13));
  });

  it("cascades transitively: A blocks B blocks C, both FS", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
      {
        sourceTaskId: "b",
        targetTaskId: "c",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 10)],
      ["b", schedule(5, 8)],
      ["c", schedule(9, 12)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    // B pushed to start at 10 (delta 5) -> (10-13). C must start >= 13, its
    // original start is 9, so it also shifts by delta 4 -> (13-16).
    expect(shifts.get("b")).toEqual(schedule(10, 13));
    expect(shifts.get("c")).toEqual(schedule(13, 16));
  });

  it("preserves each shifted task's original duration", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 20)],
      // A 1-day span (start === end).
      ["b", schedule(5, 5)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    const shiftedB = shifts.get("b");
    expect(shiftedB).toBeDefined();
    expect(shiftedB?.end.getTime()).toBe(shiftedB?.start.getTime());
  });

  it("never pulls a dependent EARLIER when the predecessor moves earlier", () => {
    // B currently starts well after A's ORIGINAL end; A moves earlier still,
    // so the FS constraint is even more satisfied than before. B must stay
    // exactly where it is.
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      // A moved from some later span to (0-2) — an earlier commit.
      ["a", schedule(0, 2)],
      ["b", schedule(20, 25)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    expect(shifts.size).toBe(0);
  });

  it("skips a dependent outside the provided scope (e.g. cross-project, or missing dates)", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "external",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    // "external" deliberately has no entry — same as a cross-project
    // dependent or a same-project task with no start/due date at all.
    const tasksById = new Map([["a", schedule(0, 10)]]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    expect(shifts.size).toBe(0);
  });

  it("does not cut the cascade short just because one branch is out of scope", () => {
    // A blocks B (in scope) and A blocks EXTERNAL (out of scope); B blocks C.
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
      {
        sourceTaskId: "a",
        targetTaskId: "external",
        dependencyType: "fs",
        lagDays: 0,
      },
      {
        sourceTaskId: "b",
        targetTaskId: "c",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 10)],
      ["b", schedule(5, 8)],
      ["c", schedule(9, 12)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    expect(shifts.has("external")).toBe(false);
    expect(shifts.get("b")).toEqual(schedule(10, 13));
    expect(shifts.get("c")).toEqual(schedule(13, 16));
  });

  it("combines multiple incoming edges by taking the strictest (max) forced delta", () => {
    // C is blocked by both A (FS) and B (FS); only A's constraint is
    // violated, but the combined result must still satisfy both.
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "c",
        dependencyType: "fs",
        lagDays: 0,
      },
      {
        sourceTaskId: "b",
        targetTaskId: "c",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 20)],
      ["b", schedule(0, 3)],
      ["c", schedule(5, 8)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    // A forces C.start >= 20 (delta 15); B forces C.start >= 3 (already
    // satisfied). The stricter one wins.
    expect(shifts.get("c")).toEqual(schedule(20, 23));
  });

  it("nudges a shifted task's start forward off a weekend, preserving its span", () => {
    // day(2) = 2026-01-03 = Saturday, day(3) = Sunday, day(4) = Monday. A
    // (ending day 2) forces B's start onto the Saturday; B must land on the
    // following Monday instead, with its original 3-day span intact.
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 2)],
      ["b", schedule(0, 3)],
    ]);

    const isWorkingDay = (d: Date) => {
      const dow = d.getUTCDay();
      return dow !== 0 && dow !== 6;
    };

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
      isWorkingDay,
    });

    // Forced start = A.end (day 2, Saturday), delta = 2 - 0 = 2. Nudged
    // forward 2 more days (Sat, Sun) to day 4 (Monday); end carries the same
    // +4 total, from day 3 to day 7.
    expect(shifts.get("b")).toEqual(schedule(4, 7));
  });

  it("nudges a shifted task's start forward off a workspace holiday", () => {
    // day(5) = 2026-01-06 (Tuesday) is declared a holiday for this test.
    const holiday = day(5).getTime();
    const isWorkingDay = (d: Date) => {
      if (d.getTime() === holiday) return false;
      const dow = d.getUTCDay();
      return dow !== 0 && dow !== 6;
    };

    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 5)], // ends on the holiday, day(5)
      ["b", schedule(0, 2)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
      isWorkingDay,
    });

    // Forced start = day(5) (the holiday); day(6) is Wednesday, a working
    // day, so B nudges forward exactly one day.
    expect(shifts.get("b")).toEqual(schedule(6, 8));
  });

  it("propagates a nudged schedule further downstream through the chain", () => {
    // A pushes B onto Saturday (day 2); B nudges to Monday (day 4). C is
    // blocked by B FS with 0 lag, originally comfortably after B's
    // PRE-nudge schedule but not its POST-nudge one, so C must also shift.
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
      {
        sourceTaskId: "b",
        targetTaskId: "c",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 2)],
      ["b", schedule(0, 3)],
      // C originally starts at day 3: satisfies B's pre-nudge end (3) but
      // not its post-nudge end (7).
      ["c", schedule(3, 5)],
    ]);

    const isWorkingDay = (d: Date) => {
      const dow = d.getUTCDay();
      return dow !== 0 && dow !== 6;
    };

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
      isWorkingDay,
    });

    // B: forced start day 2 (Saturday) -> nudged to day 4 (Monday), end day 7.
    expect(shifts.get("b")).toEqual(schedule(4, 7));
    // C: forced start >= B.end (7); original start 3, delta 4 -> (7, 9).
    // day(7) is Wednesday, a working day, so no further nudge.
    expect(shifts.get("c")).toEqual(schedule(7, 9));
  });

  it("never nudges when no isWorkingDay predicate is given (unchanged behavior)", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([
      ["a", schedule(0, 2)], // forces B.start to land on Saturday (day 2)
      ["b", schedule(0, 3)],
    ]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    // No predicate supplied: B lands exactly on day 2, weekend or not.
    expect(shifts.get("b")).toEqual(schedule(2, 5));
  });

  it("returns nothing when the moved task itself is unscoped", () => {
    const edges: CascadeEdge[] = [
      {
        sourceTaskId: "a",
        targetTaskId: "b",
        dependencyType: "fs",
        lagDays: 0,
      },
    ];
    const tasksById = new Map([["b", schedule(0, 5)]]);

    const shifts = computeDependencyCascade({
      movedTaskId: "a",
      edges,
      tasksById,
    });

    expect(shifts.size).toBe(0);
  });
});
