import {
  and,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { defaultDueWeekStart, weekRange } from "./due-week-start";
import type { GLOBAL_BOARD_FILTER_SUBJECTS } from "./schema";

type Subject = (typeof GLOBAL_BOARD_FILTER_SUBJECTS)[number];

export type GlobalBoardFilterQuery = {
  workspaceId?: string[];
  projectId?: string[];
  assigneeId?: string[];
  priority?: string[];
  label?: string[];
  dueDate?: string[];
  negate?: Subject[];
  dueWeekStart?: string;
};

function assigneeCondition(values: string[], userId: string) {
  const ids = values
    .filter((value) => value !== "unassigned")
    .map((value) => (value === "me" ? userId : value));
  return or(
    ids.length ? inArray(taskTable.userId, ids) : undefined,
    values.includes("unassigned") ? isNull(taskTable.userId) : undefined,
  );
}

function labelCondition(names: string[]) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(labelTable)
      .where(
        and(
          eq(labelTable.taskId, taskTable.id),
          inArray(
            sql`lower(${labelTable.name})`,
            names.map((name) => name.toLowerCase()),
          ),
        ),
      ),
  );
}

function dueDateCondition(values: string[], weekStartParam?: string) {
  const weekStart = weekStartParam
    ? new Date(weekStartParam)
    : defaultDueWeekStart(new Date());
  const inWeek = (weeksAhead: number) => {
    const { start, end } = weekRange(weekStart, weeksAhead);
    return and(gte(taskTable.dueDate, start), lt(taskTable.dueDate, end));
  };
  return or(
    values.includes("dueThisWeek") ? inWeek(0) : undefined,
    values.includes("dueNextWeek") ? inWeek(1) : undefined,
    values.includes("noDueDate") ? isNull(taskTable.dueDate) : undefined,
  );
}

/**
 * One condition per active filter, the same way project boards filter: any of
 * a filter's values matches, every filter must match, and a negated filter
 * keeps the tasks it would otherwise drop, including tasks with no value.
 */
export function globalBoardFilterConditions(
  query: GlobalBoardFilterQuery,
  userId: string,
): Array<SQL | undefined> {
  const negated = new Set(query.negate ?? []);
  const build: Record<Subject, (values: string[]) => SQL | undefined> = {
    workspaceId: (values) => inArray(projectTable.workspaceId, values),
    projectId: (values) => inArray(taskTable.projectId, values),
    assigneeId: (values) => assigneeCondition(values, userId),
    priority: (values) => inArray(taskTable.priority, values),
    label: labelCondition,
    dueDate: (values) => dueDateCondition(values, query.dueWeekStart),
  };

  return (Object.keys(build) as Subject[]).map((subject) => {
    const values = query[subject];
    if (!values?.length) return undefined;
    const condition = build[subject](values);
    if (!condition) return undefined;
    return negated.has(subject)
      ? sql`not coalesce(${condition}, false)`
      : condition;
  });
}
