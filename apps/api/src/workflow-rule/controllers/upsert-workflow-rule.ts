import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, workflowRuleTable } from "../../database/schema";

async function upsertWorkflowRule({
  projectId,
  integrationType,
  eventType,
  columnId,
}: {
  projectId: string;
  integrationType: string;
  eventType: string;
  columnId: string;
}) {
  const targetColumn = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.id, columnId),
      eq(columnTable.projectId, projectId),
    ),
  });

  if (!targetColumn) {
    throw new HTTPException(400, {
      message: "Column does not belong to the provided project",
    });
  }

  const existing = await db.query.workflowRuleTable.findFirst({
    where: and(
      eq(workflowRuleTable.projectId, projectId),
      eq(workflowRuleTable.integrationType, integrationType),
      eq(workflowRuleTable.eventType, eventType),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(workflowRuleTable)
      .set({ columnId })
      .where(eq(workflowRuleTable.id, existing.id))
      .returning();

    if (!updated) {
      throw new HTTPException(500, {
        message: "Failed to update workflow rule",
      });
    }

    return updated;
  }

  const [created] = await db
    .insert(workflowRuleTable)
    .values({
      projectId,
      integrationType,
      eventType,
      columnId,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create workflow rule",
    });
  }

  return created;
}

export default upsertWorkflowRule;
