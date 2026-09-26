import { describe, expect, it } from "vitest";
import {
  type CriticalPathEdgeInput,
  type CriticalPathTaskInput,
  computeCriticalPath,
} from "./gantt-critical-path";

function day(n: number): Date {
  // Whole UTC days from a fixed epoch, so spans/deltas are easy to reason
  // about in each test without pulling in date-fns just for arithmetic.
  return new Date(Date.UTC(2026, 0, 1 + n));
}

function task(id: string, start: number, end: number): CriticalPathTaskInput {
  return { id, scheduleStart: day(start), scheduleEnd: day(end) };
}

function blocks(
  id: string,
  sourceTaskId: string,
  targetTaskId: string,
  dependencyType: CriticalPathEdgeInput["dependencyType"] = "fs",
  lagDays = 0,
): CriticalPathEdgeInput {
  return { id, sourceTaskId, targetTaskId, dependencyType, lagDays };
}

describe("computeCriticalPath", () => {
  it("marks every task and edge critical along a tight simple chain", () => {
    // A(0-2) -FS,0-> B(2-5) -FS,0-> C(5-8): each task starts the instant its
    // predecessor finishes, so there is no slack anywhere on the chain.
    const tasks = [task("a", 0, 2), task("b", 2, 5), task("c", 5, 8)];
    const edges = [blocks("e1", "a", "b"), blocks("e2", "b", "c")];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds).toEqual(new Set(["a", "b", "c"]));
    expect(result.criticalEdgeIds).toEqual(new Set(["e1", "e2"]));
  });

  it("only marks the longer branch critical in a diamond with one slack branch", () => {
    // A(0-2) forks into B(2-6, 4-day) and C(2-3, 1-day), both FS into
    // D(6-8) — D's own dates are tight against the LONGER branch (B), so B
    // finishing exactly when D starts is critical, while C arrives 3 days
    // early and carries that much slack.
    const tasks = [
      task("a", 0, 2),
      task("b", 2, 6),
      task("c", 2, 3),
      task("d", 6, 8),
    ];
    const edges = [
      blocks("ab", "a", "b"),
      blocks("ac", "a", "c"),
      blocks("bd", "b", "d"),
      blocks("cd", "c", "d"),
    ];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds).toEqual(new Set(["a", "b", "d"]));
    expect(result.criticalTaskIds.has("c")).toBe(false);
    expect(result.criticalEdgeIds).toEqual(new Set(["ab", "bd"]));
    expect(result.criticalEdgeIds.has("ac")).toBe(false);
    expect(result.criticalEdgeIds.has("cd")).toBe(false);
  });

  it("treats parallel independent tasks as each trivially critical", () => {
    // No edges at all: each task is simultaneously its own root and sink, so
    // ES=LS and EF=LF by construction for every one of them.
    const tasks = [task("a", 0, 3), task("b", 10, 12), task("c", 5, 5)];

    const result = computeCriticalPath(tasks, []);

    expect(result.criticalTaskIds).toEqual(new Set(["a", "b", "c"]));
    expect(result.criticalEdgeIds.size).toBe(0);
  });

  it("treats a lone task with no dependencies as trivially critical", () => {
    const result = computeCriticalPath([task("solo", 3, 9)], []);

    expect(result.criticalTaskIds).toEqual(new Set(["solo"]));
    expect(result.criticalEdgeIds.size).toBe(0);
  });

  it("a positive lag that exactly matches the gap keeps the link critical", () => {
    // A(0-2) -FS,+3-> B: required start is A.end(2)+3=5, and B is dated
    // (5-8) to match exactly — zero slack.
    const tasks = [task("a", 0, 2), task("b", 5, 8)];
    const edges = [blocks("e1", "a", "b", "fs", 3)];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds).toEqual(new Set(["a", "b"]));
    expect(result.criticalEdgeIds).toEqual(new Set(["e1"]));
  });

  it("the same lag introduces slack once the target's own dates sit later", () => {
    // Same FS,+3 lag (required start still 5), but B is actually dated
    // starting on day 7 — 2 days later than the network requires, so both
    // ends of the link carry 2 days of slack and neither is critical.
    const tasks = [task("a", 0, 2), task("b", 7, 10)];
    const edges = [blocks("e1", "a", "b", "fs", 3)];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds.size).toBe(0);
    expect(result.criticalEdgeIds.size).toBe(0);
  });

  it("honors SS (start-to-start) with lag", () => {
    // A(0-3) -SS,+1-> B: B's earliest start is A.start(0)+1=1; B is dated
    // (1-4) to match exactly.
    const tasks = [task("a", 0, 3), task("b", 1, 4)];
    const edges = [blocks("e1", "a", "b", "ss", 1)];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds).toEqual(new Set(["a", "b"]));
    expect(result.criticalEdgeIds).toEqual(new Set(["e1"]));
  });

  it("honors FF (finish-to-finish) with lag", () => {
    // A(0-5, duration 5) -FF,0-> B (duration 2): B's earliest finish is
    // A.end(5)+0=5, so B's earliest start is 5-2=3; B is dated (3-5) to
    // match exactly.
    const tasks = [task("a", 0, 5), task("b", 3, 5)];
    const edges = [blocks("e1", "a", "b", "ff", 0)];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds).toEqual(new Set(["a", "b"]));
    expect(result.criticalEdgeIds).toEqual(new Set(["e1"]));
  });

  it("honors SF (start-to-finish) with lag", () => {
    // A(2-6) -SF,0-> B (duration 3): B's earliest finish is A.start(2)+0=2,
    // so B's earliest start is 2-3=-1; B is dated (-1-2) to match exactly.
    const tasks = [task("a", 2, 6), task("b", -1, 2)];
    const edges = [blocks("e1", "a", "b", "sf", 0)];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds).toEqual(new Set(["a", "b"]));
    expect(result.criticalEdgeIds).toEqual(new Set(["e1"]));
  });

  it("drops edges reaching outside the participating task set", () => {
    // "b" isn't in the task list (a cross-project/dateless task, per the
    // caller's own filtering) — the edge into it must not blow up, and must
    // not affect "a"'s own criticality.
    const tasks = [task("a", 0, 2)];
    const edges = [blocks("e1", "a", "b")];

    const result = computeCriticalPath(tasks, edges);

    expect(result.criticalTaskIds).toEqual(new Set(["a"]));
    expect(result.criticalEdgeIds.size).toBe(0);
  });
});
