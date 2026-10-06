import { and, eq, not, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { pauseIssueLinks } from "../../plugins/sync/pause-issue-links";
import { outgoingPredicate } from "../../plugins/sync/task-predicate";
import { readSyncRules, type SyncRules } from "../../plugins/sync/rules";
import { getSyncIntegration } from "./get-integration";
import { getAuthorizedSyncProject } from "./authorized-project";
import { previewSyncRules } from "./preview-rules";

export async function saveSyncRules(
  projectId: string,
  provider: string,
  rules: SyncRules,
  previewToken: string,
  authorizedWorkspaceId: string,
) {
  const integration = await getSyncIntegration(projectId, provider);
  const savedPreview = await db.transaction(async (tx) => {
    // Keep the workspace authorized by middleware stable through the save.
    const project = await getAuthorizedSyncProject(
      projectId,
      authorizedWorkspaceId,
      tx,
      true,
    );
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
    const currentIntegration = { ...integration, ...current, project };
    const preview = await previewSyncRules(currentIntegration, rules, tx);
    if (preview.previewToken !== previewToken)
      throw new HTTPException(409, {
        message: "Sync impact changed; preview again before saving",
      });
    if (preview.missingLabels.length)
      throw new HTTPException(400, {
        message: "Select existing labels from this workspace",
      });
    const oldScope = await outgoingPredicate(
      project.workspaceId,
      readSyncRules(current.config)!.outgoing,
      tx,
    );
    const nextScope = await outgoingPredicate(
      project.workspaceId,
      rules.outgoing,
      tx,
    );
    await pauseIssueLinks(
      projectId,
      integration.id,
      or(not(oldScope.predicate), not(nextScope.predicate))!,
      tx,
    );
    const config = JSON.parse(current.config) as Record<string, unknown>;
    const nextConfig = JSON.stringify({ ...config, syncRules: rules });
    await tx
      .update(integrationTable)
      .set({
        config: nextConfig,
        updatedAt: new Date(),
      })
      .where(eq(integrationTable.id, integration.id));
    // A post-commit project move must not expose the destination's labels.
    return previewSyncRules(
      { ...currentIntegration, config: nextConfig },
      rules,
      tx,
    );
  });
  await publishEvent("integration.sync_rules_changed", {
    projectId,
    integrationId: integration.id,
  });
  await publishEvent("project.updated", { projectId, linksChanged: true });
  return savedPreview;
}
