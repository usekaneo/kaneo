import { and, eq } from "drizzle-orm";
import {
  columnTable,
  tangledTaskOwnershipTable,
  taskTable,
  workflowRuleTable,
} from "../../database/schema";
import type { TangledTransaction, TangledConnection } from "./connection";

type StatusChange = {
  taskId: string;
  projectId: string;
  sourceIntegrationId: string;
  userId: null;
  oldStatus: string;
  newStatus: string;
  title: string;
  assigneeId: string | null;
  type: "status_changed";
};

// The caller holds the task row lock until the transaction commits.
export async function applyTangledWorkflow(
  tx: TangledTransaction,
  connection: TangledConnection,
  taskId: string,
): Promise<StatusChange | null> {
  const [task] = await tx
    .select()
    .from(taskTable)
    .where(
      and(
        eq(taskTable.id, taskId),
        eq(taskTable.projectId, connection.projectId),
      ),
    )
    .for("no key update");
  if (!task) return null;
  const [rule] = await tx
    .select({ id: columnTable.id, slug: columnTable.slug })
    .from(workflowRuleTable)
    .innerJoin(
      columnTable,
      and(
        eq(columnTable.id, workflowRuleTable.columnId),
        eq(columnTable.projectId, connection.projectId),
      ),
    )
    .where(
      and(
        eq(workflowRuleTable.projectId, connection.projectId),
        eq(workflowRuleTable.integrationType, "tangled"),
        eq(workflowRuleTable.eventType, "branch_push"),
      ),
    )
    .limit(1);
  if (!rule) return null;
  const ownership = await tx.query.tangledTaskOwnershipTable.findFirst({
    where: eq(tangledTaskOwnershipTable.taskId, task.id),
  });
  if (
    ownership &&
    (ownership.integrationId !== connection.id ||
      ownership.statusRevision !== task.statusRevision)
  )
    return null;
  const [updated] =
    task.status === rule.slug && task.columnId === rule.id
      ? [task]
      : await tx
          .update(taskTable)
          .set({ status: rule.slug, columnId: rule.id })
          .where(
            and(
              eq(taskTable.id, task.id),
              eq(taskTable.projectId, connection.projectId),
            ),
          )
          .returning();
  if (!updated) throw new Error("Tangled task status could not be updated");
  await tx
    .insert(tangledTaskOwnershipTable)
    .values({
      taskId: task.id,
      integrationId: connection.id,
      statusRevision: updated.statusRevision,
    })
    .onConflictDoUpdate({
      target: tangledTaskOwnershipTable.taskId,
      set: { statusRevision: updated.statusRevision },
    });
  if (task.status === updated.status) return null;
  return {
    taskId: task.id,
    projectId: task.projectId,
    sourceIntegrationId: connection.id,
    userId: null,
    oldStatus: task.status,
    newStatus: updated.status,
    title: updated.title,
    assigneeId: updated.userId,
    type: "status_changed",
  };
}
