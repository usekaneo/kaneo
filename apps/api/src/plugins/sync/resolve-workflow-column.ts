import { and, asc, eq } from "drizzle-orm";
import db from "../../database";
import { columnTable, workflowRuleTable } from "../../database/schema";

export type WorkflowIntegrationType = "github" | "gitlab" | "gitea";

export type WorkflowResolutionDb = Pick<typeof db, "select" | "query">;

/**
 * Resolves the target column slug for a workflow automation event.
 * When no matching rule exists and `fallbackStatus` is `null` ("Don't move"),
 * returns `null` instead of falling back to another column.
 */
export async function resolveWorkflowColumnSlug(
  projectId: string,
  integrationType: WorkflowIntegrationType,
  eventType: string,
  fallbackStatus: string,
  database?: WorkflowResolutionDb,
): Promise<string>;
export async function resolveWorkflowColumnSlug(
  projectId: string,
  integrationType: WorkflowIntegrationType,
  eventType: string,
  fallbackStatus: string | null,
  database?: WorkflowResolutionDb,
): Promise<string | null>;
export async function resolveWorkflowColumnSlug(
  projectId: string,
  integrationType: WorkflowIntegrationType,
  eventType: string,
  fallbackStatus: string | null,
  database: WorkflowResolutionDb = db,
): Promise<string | null> {
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

  const rule = await database.query.workflowRuleTable.findFirst({
    where: and(
      eq(workflowRuleTable.projectId, projectId),
      eq(workflowRuleTable.integrationType, integrationType),
      eq(workflowRuleTable.eventType, eventType),
    ),
  });

  if (rule) {
    const mappedColumn = projectColumns.find(
      (column) => column.id === rule.columnId,
    );
    if (mappedColumn) {
      return mappedColumn.slug;
    }
  }

  if (fallbackStatus === null) {
    return null;
  }

  const fallbackColumn = projectColumns.find(
    (column) => column.slug === fallbackStatus,
  );
  if (fallbackColumn) {
    return fallbackColumn.slug;
  }

  return projectColumns[0]?.slug ?? fallbackStatus;
}
