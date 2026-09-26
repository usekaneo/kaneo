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
