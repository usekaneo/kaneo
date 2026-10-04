import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  externalLinkTable,
  integrationTable,
  labelTable,
  taskTable,
} from "../../database/schema";
import type { IntegrationDatabase } from "../../plugins/github/services/integration-task-scope";
import { readSyncRules } from "../../plugins/sync/rules";
import { getSyncIntegration } from "./get-integration";
import { getAuthorizedSyncProject } from "./authorized-project";

export async function lockResumeScope(
  projectId: string,
  provider: string,
  linkId: string,
  authorizedWorkspaceId: string,
  tx: IntegrationDatabase,
) {
  await getAuthorizedSyncProject(projectId, authorizedWorkspaceId, tx, true);
  const integration = await getSyncIntegration(projectId, provider, tx);
  const [binding] = await tx
    .select()
    .from(integrationTable)
    .where(eq(integrationTable.id, integration.id))
    .for("share");
  const link = await tx.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.id, linkId),
      eq(externalLinkTable.integrationId, integration.id),
      eq(externalLinkTable.resourceType, "issue"),
    ),
  });
  if (!link) throw new HTTPException(404, { message: "Linked task not found" });
  await tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(
      and(eq(taskTable.id, link.taskId), eq(taskTable.projectId, projectId)),
    )
    .for("no key update");
  const rule = readSyncRules(binding!.config)?.outgoing;
  if (!rule)
    throw new HTTPException(409, {
      message: "Integration rules changed; review again",
    });
  if (rule.mode === "labels") {
    // Protect both selected roots and assigned copies against rename/deletion
    // while validating each local resume phase.
    await tx
      .select({ id: labelTable.id })
      .from(labelTable)
      .where(
        and(
          eq(labelTable.workspaceId, integration.project.workspaceId),
          or(
            and(isNull(labelTable.taskId), inArray(labelTable.id, rule.labels)),
            eq(labelTable.taskId, link.taskId),
          ),
        ),
      )
      .orderBy(labelTable.id)
      .for("share");
  }
  await tx
    .select({ id: externalLinkTable.id })
    .from(externalLinkTable)
    .where(eq(externalLinkTable.id, linkId))
    .for("update");
}
