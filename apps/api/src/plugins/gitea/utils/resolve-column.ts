import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../../database";
import { columnTable, workflowRuleTable } from "../../../database/schema";

export async function resolveTargetStatus(
  projectId: string,
  eventType: string,
  fallbackStatus: string,
  database: Pick<typeof db, "select" | "query"> = db,
  // RFC 0001 WP6: the integration row of the event's binding. When present,
  // a repository-specific rule (integration_id = the binding) wins over the
  // type-wide fallback (integration_id IS NULL). Callers without binding
  // context may omit it and get today's type-wide behavior.
  integration?: { id: string } | null,
): Promise<string> {
  const projectColumns = await database
    .select({
      id: columnTable.id,
      slug: columnTable.slug,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position));

  if (projectColumns.length === 0) {
    return fallbackStatus;
  }

  const specificRule = integration
    ? await database.query.workflowRuleTable.findFirst({
        where: and(
          eq(workflowRuleTable.projectId, projectId),
          eq(workflowRuleTable.integrationType, "gitea"),
          eq(workflowRuleTable.eventType, eventType),
          eq(workflowRuleTable.integrationId, integration.id),
        ),
      })
    : null;

  const rule =
    specificRule ??
    (await database.query.workflowRuleTable.findFirst({
      where: and(
        eq(workflowRuleTable.projectId, projectId),
        eq(workflowRuleTable.integrationType, "gitea"),
        eq(workflowRuleTable.eventType, eventType),
        isNull(workflowRuleTable.integrationId),
      ),
    }));

  if (rule) {
    const mappedColumn = projectColumns.find(
      (column) => column.id === rule.columnId,
    );
    if (mappedColumn) {
      return mappedColumn.slug;
    }
  }

  const fallbackColumn = projectColumns.find(
    (column) => column.slug === fallbackStatus,
  );
  if (fallbackColumn) {
    return fallbackColumn.slug;
  }

  return projectColumns[0]?.slug ?? fallbackStatus;
}
