import { describe, expect, it } from "vitest";
import {
  type ConstraintCheckTask,
  computeConstraintViolations,
} from "./gantt-constraint-violations";

function task(
  overrides: Partial<ConstraintCheckTask> = {},
): ConstraintCheckTask {
  return {
    id: "t1",
    constraintType: "none",
    constraintDate: null,
    startDate: null,
    dueDate: null,
    ...overrides,
  };
}

describe("computeConstraintViolations", () => {
  it("never flags a task with no constraint", () => {
    const result = computeConstraintViolations([
      task({
        startDate: "2026-01-01",
        dueDate: "2026-01-10",
        constraintType: "none",
        constraintDate: "2026-06-01",
      }),
    ]);
    expect(result.size).toBe(0);
  });

  it("flags a start_no_earlier_than task that starts before the constraint date", () => {
    const result = computeConstraintViolations([
      task({
        constraintType: "start_no_earlier_than",
        constraintDate: "2026-01-10",
        startDate: "2026-01-05",
      }),
    ]);
    expect(result.has("t1")).toBe(true);
  });

  it("does not flag start_no_earlier_than when the start is on or after the constraint date", () => {
    const onDate = computeConstraintViolations([
      task({
        constraintType: "start_no_earlier_than",
        constraintDate: "2026-01-10",
        startDate: "2026-01-10",
      }),
    ]);
    const afterDate = computeConstraintViolations([
      task({
        constraintType: "start_no_earlier_than",
        constraintDate: "2026-01-10",
        startDate: "2026-01-15",
      }),
    ]);
    expect(onDate.size).toBe(0);
    expect(afterDate.size).toBe(0);
  });

  it("flags must_start_on when the start is not exactly the constraint date, in either direction", () => {
    const before = computeConstraintViolations([
      task({
        constraintType: "must_start_on",
        constraintDate: "2026-01-10",
        startDate: "2026-01-05",
      }),
    ]);
    const after = computeConstraintViolations([
      task({
        constraintType: "must_start_on",
        constraintDate: "2026-01-10",
        startDate: "2026-01-15",
      }),
    ]);
    expect(before.has("t1")).toBe(true);
    expect(after.has("t1")).toBe(true);
  });

  it("does not flag must_start_on when the start matches exactly", () => {
    const result = computeConstraintViolations([
      task({
        constraintType: "must_start_on",
        constraintDate: "2026-01-10",
        startDate: "2026-01-10",
      }),
    ]);
    expect(result.size).toBe(0);
  });

  it("flags finish_no_later_than when the due date is after the deadline", () => {
    const result = computeConstraintViolations([
      task({
        constraintType: "finish_no_later_than",
        constraintDate: "2026-01-10",
        dueDate: "2026-01-15",
      }),
    ]);
    expect(result.has("t1")).toBe(true);
  });

  it("does not flag finish_no_later_than when the due date is on or before the deadline", () => {
    const result = computeConstraintViolations([
      task({
        constraintType: "finish_no_later_than",
        constraintDate: "2026-01-10",
        dueDate: "2026-01-10",
      }),
      task({
        id: "t2",
        constraintType: "finish_no_later_than",
        constraintDate: "2026-01-10",
        dueDate: "2026-01-05",
      }),
    ]);
    expect(result.size).toBe(0);
  });

  it("skips a task missing the date its constraint needs (nothing to compare)", () => {
    const result = computeConstraintViolations([
      task({
        constraintType: "start_no_earlier_than",
        constraintDate: "2026-01-10",
        startDate: null,
      }),
      task({
        id: "t2",
        constraintType: "finish_no_later_than",
        constraintDate: "2026-01-10",
        dueDate: null,
      }),
    ]);
    expect(result.size).toBe(0);
  });

  it("a constraint with no constraintDate is never flagged (defensive; the API requires one)", () => {
    const result = computeConstraintViolations([
      task({
        constraintType: "must_start_on",
        constraintDate: null,
        startDate: "2026-01-05",
      }),
    ]);
    expect(result.size).toBe(0);
  });

  it("a milestone with only a startDate uses it as both start and finish", () => {
    // FNLT deadline before the milestone's single date: violates via the due
    // side, even though dueDate itself is null.
    const result = computeConstraintViolations([
      task({
        constraintType: "finish_no_later_than",
        constraintDate: "2026-01-10",
        startDate: "2026-01-15",
        dueDate: null,
        isMilestone: true,
      }),
    ]);
    expect(result.has("t1")).toBe(true);
  });

  it("a milestone with only a dueDate uses it as both start and finish", () => {
    const result = computeConstraintViolations([
      task({
        constraintType: "start_no_earlier_than",
        constraintDate: "2026-01-10",
        startDate: null,
        dueDate: "2026-01-05",
        isMilestone: true,
      }),
    ]);
    expect(result.has("t1")).toBe(true);
  });

  it("evaluates each task independently", () => {
    const result = computeConstraintViolations([
      task({
        id: "ok",
        constraintType: "start_no_earlier_than",
        constraintDate: "2026-01-10",
        startDate: "2026-01-20",
      }),
      task({
        id: "bad",
        constraintType: "must_start_on",
        constraintDate: "2026-01-10",
        startDate: "2026-01-11",
      }),
    ]);
    expect(result.has("ok")).toBe(false);
    expect(result.has("bad")).toBe(true);
    expect(result.size).toBe(1);
  });
});
