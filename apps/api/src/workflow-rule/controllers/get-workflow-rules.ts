import { eq } from "drizzle-orm";
import db from "../../database";
import { columnTable, workflowRuleTable } from "../../database/schema";

async function getWorkflowRules(projectId: string) {
  const rules = await db
    .select({
      id: workflowRuleTable.id,
      projectId: workflowRuleTable.projectId,
      integrationType: workflowRuleTable.integrationType,
      eventType: workflowRuleTable.eventType,
      columnId: workflowRuleTable.columnId,
      columnName: columnTable.name,
      columnSlug: columnTable.slug,
      createdAt: workflowRuleTable.createdAt,
      updatedAt: workflowRuleTable.updatedAt,
    })
    .from(workflowRuleTable)
    .leftJoin(columnTable, eq(workflowRuleTable.columnId, columnTable.id))
    .where(eq(workflowRuleTable.projectId, projectId));

  return rules;
}

export default getWorkflowRules;
