import { and, eq, gt, isNotNull, lte, or } from "drizzle-orm";
import { schema } from "../../database";
import type { AgentDatabase } from "../access";
import { appendAutomationEvent } from "./ingest-event";
import { AUTOMATION_DUE_DATE_LOOKBACK_MS } from "./limits";

// Called under the automation lock; cursor and event insert commit together.
export async function collectAutomationDueDates(
  tx: AgentDatabase,
  row: typeof schema.agentAutomationTable.$inferSelect,
  now: Date,
) {
  const after =
    row.eventCursorAt ??
    new Date(now.getTime() - AUTOMATION_DUE_DATE_LOOKBACK_MS);
  let cursor: { dueDate: Date; taskId: string } | undefined;
  while (true) {
    const tasks = await tx
      .select({
        taskId: schema.taskTable.id,
        projectId: schema.taskTable.projectId,
        dueDate: schema.taskTable.dueDate,
      })
      .from(schema.taskTable)
      .innerJoin(
        schema.projectTable,
        eq(schema.taskTable.projectId, schema.projectTable.id),
      )
      .where(
        and(
          eq(schema.projectTable.workspaceId, row.workspaceId),
          row.projectId
            ? eq(schema.taskTable.projectId, row.projectId)
            : undefined,
          isNotNull(schema.taskTable.dueDate),
          gt(schema.taskTable.dueDate, after),
          lte(schema.taskTable.dueDate, now),
          cursor
            ? or(
                gt(schema.taskTable.dueDate, cursor.dueDate),
                and(
                  eq(schema.taskTable.dueDate, cursor.dueDate),
                  gt(schema.taskTable.id, cursor.taskId),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(schema.taskTable.dueDate, schema.taskTable.id)
      .limit(200);
    for (const task of tasks)
      await appendAutomationEvent(
        tx,
        row,
        "due_date_passed",
        task,
        `due:${task.taskId}:${task.dueDate!.toISOString()}`,
        now,
      );
    if (tasks.length < 200) break;
    const last = tasks.at(-1)!;
    cursor = { dueDate: last.dueDate!, taskId: last.taskId };
  }
  await tx
    .update(schema.agentAutomationTable)
    .set({ eventCursorAt: now })
    .where(eq(schema.agentAutomationTable.id, row.id));
}
