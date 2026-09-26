// Pure helper for the Gantt's deadline/constraint violation indicator (Phase
// 3c-ii). Kept free of React and the DOM, like the rest of this folder's pure
// modules (gantt-dependency-cascade.ts, dependency-lines.ts, ...), so the
// check is unit-testable directly.
//
// The four constraint types (see taskTable.constraintType in
// apps/api/src/database/schema.ts) and what counts as a violation:
//  - "none": never violating.
//  - "start_no_earlier_than" (SNET): violated when the task's start is
//    BEFORE constraintDate.
//  - "must_start_on" (MSO): violated when the task's start is not EXACTLY
//    constraintDate (either direction).
//  - "finish_no_later_than" (FNLT): a deadline — violated when the task's
//    finish (dueDate) is AFTER constraintDate.
// A task missing the date a check needs (e.g. no startDate for SNET/MSO) is
// left out of the result — nothing to compare against, so nothing to flag.
// A milestone (start === due conceptually) may only carry one of the two
// dates; the other falls back to it, same as deriveTaskSchedule elsewhere in
// this folder.

export type TaskConstraintType =
  | "none"
  | "start_no_earlier_than"
  | "finish_no_later_than"
  | "must_start_on";

export type ConstraintCheckTask = {
  id: string;
  constraintType?: string | null;
  constraintDate?: string | Date | null;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  isMilestone?: boolean;
};

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Flags every task whose own dates violate its own scheduling constraint.
 * Returns a Set of violating task ids — a task with no constraint (or one
 * that can't be evaluated for lack of a date) is simply absent, never in the
 * set with a "false" value.
 */
export function computeConstraintViolations(
  tasks: readonly ConstraintCheckTask[],
): Set<string> {
  const violating = new Set<string>();

  for (const task of tasks) {
    const constraintDate = toTime(task.constraintDate);
    if (
      !task.constraintType ||
      task.constraintType === "none" ||
      constraintDate === null
    ) {
      continue;
    }

    let start = toTime(task.startDate);
    let due = toTime(task.dueDate);
    if (task.isMilestone) {
      if (start === null) start = due;
      if (due === null) due = start;
    }

    switch (task.constraintType as TaskConstraintType) {
      case "start_no_earlier_than":
        if (start !== null && start < constraintDate) violating.add(task.id);
        break;
      case "must_start_on":
        if (start !== null && start !== constraintDate) violating.add(task.id);
        break;
      case "finish_no_later_than":
        if (due !== null && due > constraintDate) violating.add(task.id);
        break;
      default:
        break;
    }
  }

  return violating;
}
