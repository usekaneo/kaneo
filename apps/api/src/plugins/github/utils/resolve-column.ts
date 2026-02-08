import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { columnTable, workflowRuleTable } from "../../../database/schema";

export async function resolveTargetStatus(
  projectId: string,
  eventType: string,
  fallbackStatus: string,
): Promise<string> {
  const rule = await db.query.workflowRuleTable.findFirst({
    where: and(
      eq(workflowRuleTable.projectId, projectId),
      eq(workflowRuleTable.integrationType, "github"),
      eq(workflowRuleTable.eventType, eventType),
    ),
  });

  if (!rule) {
    return fallbackStatus;
  }

  const column = await db.query.columnTable.findFirst({
    where: eq(columnTable.id, rule.columnId),
  });

  return column?.slug ?? fallbackStatus;
}
