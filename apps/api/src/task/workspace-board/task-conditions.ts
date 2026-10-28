import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { labelTable, taskTable } from "../../database/schema";
import { UNASSIGNED_FILTER } from "../schema";
import { taskInFinalColumn } from "../task-in-final-column";
import { VIRTUAL_STATUSES } from "../validate-task-fields";

export type WorkspaceBoardTaskFilters = {
  assigneeIds?: string[];
  status?: string[];
  priority?: string[];
  labelIds?: string[];
  dueBefore?: Date;
  dueAfter?: Date;
  includeCompleted?: boolean;
};

export function workspaceBoardTaskConditions(
  workspaceId: string,
  projectIds: string[],
  filters: WorkspaceBoardTaskFilters,
) {
  const conditions: (SQL | undefined)[] = [
    inArray(taskTable.projectId, projectIds),
    notInArray(taskTable.status, [...VIRTUAL_STATUSES]),
  ];
  if (!filters.includeCompleted) {
    conditions.push(sql`not ${taskInFinalColumn}`);
  }
  if (filters.status?.length) {
    conditions.push(inArray(taskTable.status, filters.status));
  }
  if (filters.priority?.length) {
    conditions.push(inArray(taskTable.priority, filters.priority));
  }
  if (filters.assigneeIds?.length) {
    const userIds = filters.assigneeIds.filter(
      (id) => id !== UNASSIGNED_FILTER,
    );
    const includeUnassigned = filters.assigneeIds.includes(UNASSIGNED_FILTER);
    conditions.push(
      or(
        userIds.length ? inArray(taskTable.userId, userIds) : undefined,
        includeUnassigned ? isNull(taskTable.userId) : undefined,
      ),
    );
  }
  if (filters.labelIds?.length) {
    // Every task carries its own copy of a label, so one id stands for every
    // label of this workspace with the same name and color.
    const selected = alias(labelTable, "selected_label");
    conditions.push(
      sql`exists (
        select 1 from ${labelTable}
        where ${labelTable.taskId} = ${taskTable.id}
          and exists (
            select 1 from ${labelTable} ${selected}
            where ${inArray(selected.id, filters.labelIds)}
              and ${eq(selected.workspaceId, workspaceId)}
              and ${selected.name} = ${labelTable.name}
              and ${selected.color} = ${labelTable.color}
          )
      )`,
    );
  }
  if (filters.dueBefore) {
    conditions.push(lte(taskTable.dueDate, filters.dueBefore));
  }
  if (filters.dueAfter) {
    conditions.push(gte(taskTable.dueDate, filters.dueAfter));
  }
  return and(...conditions);
}
