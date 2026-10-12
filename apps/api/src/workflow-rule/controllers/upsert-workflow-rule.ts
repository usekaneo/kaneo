import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  integrationTable,
  workflowRuleTable,
} from "../../database/schema";

async function upsertWorkflowRule({
  projectId,
  integrationType,
  eventType,
  columnId,
  integrationId,
}: {
  projectId: string;
  integrationType: string;
  eventType: string;
  columnId: string;
  // RFC 0001 WP6: optional repository binding. Absent (or null) keeps the
  // legacy type-wide semantics: one rule per (project, type, event).
  integrationId?: string | null;
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

  // A repository-specific rule must reference an integration of the same
  // type in the same project. The route middleware (fromIntegration) already
  // verified workspace access for the integration row.
  let scopedIntegrationId: string | null = null;
  if (integrationId) {
    const integration = await db.query.integrationTable.findFirst({
      where: eq(integrationTable.id, integrationId),
    });

    if (!integration) {
      throw new HTTPException(404, {
        message: "Integration not found",
      });
    }

    if (integration.projectId !== projectId) {
      throw new HTTPException(400, {
        message: "Integration does not belong to the provided project",
      });
    }

    if (integration.type !== integrationType) {
      throw new HTTPException(400, {
        message: "Integration type does not match the rule's integration type",
      });
    }

    scopedIntegrationId = integration.id;
  }

  // NULL never matches with SQL equality, so the lookup key must be
  // NULL-aware: an explicit isNull for type-wide rules, an exact match for
  // repository-specific ones.
  const existing = await db.query.workflowRuleTable.findFirst({
    where: scopedIntegrationId
      ? and(
          eq(workflowRuleTable.projectId, projectId),
          eq(workflowRuleTable.integrationType, integrationType),
          eq(workflowRuleTable.eventType, eventType),
          eq(workflowRuleTable.integrationId, scopedIntegrationId),
        )
      : and(
          eq(workflowRuleTable.projectId, projectId),
          eq(workflowRuleTable.integrationType, integrationType),
          eq(workflowRuleTable.eventType, eventType),
          isNull(workflowRuleTable.integrationId),
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
      integrationId: scopedIntegrationId,
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
