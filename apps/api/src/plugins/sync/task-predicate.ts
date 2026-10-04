import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import db from "../../database";
import { labelTable, taskTable } from "../../database/schema";
import type { IntegrationDatabase } from "../github/services/integration-task-scope";
import type { LabelRule } from "./rules";

export async function outgoingPredicate(
  workspaceId: string,
  rule: LabelRule,
  database: IntegrationDatabase = db,
  includeAllLabels = false,
) {
  // Only the settings preview needs the full picker. Eligibility checks resolve
  // selected roots afresh without loading unrelated workspace labels.
  const labels =
    rule.mode === "all" && !includeAllLabels
      ? []
      : await database
          .select({
            id: labelTable.id,
            name: labelTable.name,
            color: labelTable.color,
          })
          .from(labelTable)
          .where(
            and(
              eq(labelTable.workspaceId, workspaceId),
              isNull(labelTable.taskId),
              isNull(labelTable.deletionStartedAt),
              !includeAllLabels && rule.mode === "labels"
                ? inArray(labelTable.id, rule.labels)
                : undefined,
            ),
          )
          .orderBy(asc(labelTable.id));
  if (rule.mode === "all")
    return { predicate: sql<boolean>`true`, labels, missing: [] as string[] };
  const selected = labels.filter((label) => rule.labels.includes(label.id));
  const missing = rule.labels.filter(
    (id) => !selected.some((label) => label.id === id),
  );
  if (missing.length || !selected.length)
    return { predicate: sql<boolean>`false`, labels, missing };
  const names = sql.join(
    selected.map((label) => sql`${label.name}`),
    sql`, `,
  );
  const predicate =
    rule.match === "any"
      ? sql<boolean>`exists (select 1 from ${labelTable} assigned where assigned.task_id = ${taskTable.id} and assigned.workspace_id = ${workspaceId} and assigned.name in (${names}))`
      : sql<boolean>`(select count(distinct assigned.name) from ${labelTable} assigned where assigned.task_id = ${taskTable.id} and assigned.workspace_id = ${workspaceId} and assigned.name in (${names})) = ${selected.length}`;
  return { predicate, labels, missing };
}
