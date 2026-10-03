import { and, eq, not, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  externalLinkTable,
  integrationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { updateExternalLink } from "../../plugins/github/services/link-manager";
import { outgoingPredicate } from "../../plugins/sync/task-predicate";
import { readSyncRules, type SyncRules } from "../../plugins/sync/rules";
import { getSyncIntegration } from "./get-integration";
import { previewSyncRules } from "./preview-rules";

export async function saveSyncRules(
  projectId: string,
  provider: string,
  rules: SyncRules,
  previewToken: string,
) {
  const integration = await getSyncIntegration(projectId, provider);
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(integrationTable)
      .where(
        and(
          eq(integrationTable.id, integration.id),
          eq(integrationTable.config, integration.config),
        ),
      )
      .for("update");
    if (!current)
      throw new HTTPException(409, {
        message: "Integration changed; preview again before saving",
      });
    const preview = await previewSyncRules(
      { ...integration, ...current },
      rules,
      tx,
    );
    if (preview.previewToken !== previewToken)
      throw new HTTPException(409, {
        message: "Sync impact changed; preview again before saving",
      });
    if (preview.missingLabels.length)
      throw new HTTPException(400, {
        message: "Select existing labels from this workspace",
      });
    const oldScope = await outgoingPredicate(
      integration.project.workspaceId,
      readSyncRules(current.config)!.outgoing,
      tx,
    );
    const nextScope = await outgoingPredicate(
      integration.project.workspaceId,
      rules.outgoing,
      tx,
    );
    const links = await tx
      .select({ id: externalLinkTable.id })
      .from(externalLinkTable)
      .innerJoin(taskTable, eq(taskTable.id, externalLinkTable.taskId))
      .where(
        and(
          eq(externalLinkTable.integrationId, integration.id),
          eq(externalLinkTable.resourceType, "issue"),
          eq(taskTable.projectId, projectId),
          or(not(oldScope.predicate), not(nextScope.predicate)),
        ),
      );
    for (const link of links)
      await updateExternalLink(
        link.id,
        { metadata: { syncFilterPaused: true } },
        tx,
      );
    const config = JSON.parse(current.config) as Record<string, unknown>;
    await tx
      .update(integrationTable)
      .set({
        config: JSON.stringify({ ...config, syncRules: rules }),
        updatedAt: new Date(),
      })
      .where(eq(integrationTable.id, integration.id));
  });
  await publishEvent("integration.sync_rules_changed", {
    projectId,
    integrationId: integration.id,
  });
  await publishEvent("project.updated", { projectId });
  return previewSyncRules(await getSyncIntegration(projectId, provider), rules);
}
