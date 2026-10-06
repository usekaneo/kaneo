import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, or, sql } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import type { IntegrationDatabase } from "../../plugins/github/services/integration-task-scope";
import { outgoingPredicate } from "../../plugins/sync/task-predicate";
import { readSyncRules, type SyncRules } from "../../plugins/sync/rules";
import type { getSyncIntegration } from "./get-integration";

export async function previewSyncRules(
  integration: Awaited<ReturnType<typeof getSyncIntegration>>,
  rules: SyncRules,
  database: IntegrationDatabase = db,
  after?: string,
) {
  const proposed = await outgoingPredicate(
    integration.project.workspaceId,
    rules.outgoing,
    database,
    true,
  );
  const current = await outgoingPredicate(
    integration.project.workspaceId,
    readSyncRules(integration.config)!.outgoing,
    database,
  );
  const paused = sql<boolean>`coalesce(${externalLinkTable.metadata} ~ '"syncFilterPaused"[[:space:]]*:[[:space:]]*true', false)`;
  const initializing = sql<boolean>`coalesce(${externalLinkTable.metadata} ~ '"syncInitializationPending"[[:space:]]*:[[:space:]]*true', false)`;
  const scope = database.$with("sync_scope").as(
    database
      .selectDistinctOn([taskTable.id], {
        id: taskTable.id,
        eligible: proposed.predicate.as("eligible"),
        current: current.predicate.as("current"),
        linkId: sql<string | null>`${externalLinkTable.id}`.as("link_id"),
        url: externalLinkTable.url,
        paused: paused.as("paused"),
        initializing: initializing.as("initializing"),
      })
      .from(taskTable)
      .leftJoin(
        externalLinkTable,
        and(
          eq(externalLinkTable.taskId, taskTable.id),
          eq(externalLinkTable.integrationId, integration.id),
          eq(externalLinkTable.resourceType, "issue"),
        ),
      )
      .where(eq(taskTable.projectId, integration.projectId))
      .orderBy(asc(taskTable.id), desc(paused), asc(externalLinkTable.id)),
  );
  const [impact] = await database
    .with(scope)
    .select({
      total: sql<number>`count(*)::int`,
      matching: sql<number>`count(*) filter (where ${scope.eligible})::int`,
      willCreate: sql<number>`count(*) filter (where ${scope.eligible} and (${scope.linkId} is null or (${scope.initializing} and not ${scope.paused})))::int`,
      willPause: sql<number>`count(*) filter (where ${scope.linkId} is not null and not ${scope.eligible} and not ${scope.paused})::int`,
      needsReview: sql<number>`count(*) filter (where ${scope.linkId} is not null and ${scope.eligible} and (${scope.paused} or not ${scope.current}))::int`,
      paused: sql<number>`count(*) filter (where ${scope.linkId} is not null and (not ${scope.eligible} or ${scope.paused}))::int`,
      // Build the ordered scope revision in PostgreSQL instead of transferring
      // every task/link to the API just to hash it. Page cursors do not affect it.
      revision: sql<string>`md5(coalesce(string_agg(jsonb_build_array(${scope.id}, ${scope.eligible}, ${scope.current}, ${scope.linkId}, ${scope.url}, ${scope.paused}, ${scope.initializing})::text, ',' order by ${scope.id}), ''))`,
    })
    .from(scope);
  const matchingTasks = await database
    .with(scope)
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
    })
    .from(scope)
    .innerJoin(taskTable, eq(taskTable.id, scope.id))
    .where(sql`${scope.eligible}`)
    .orderBy(asc(scope.id))
    .limit(10);
  const pausedPage = await database
    .with(scope)
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      linkId: scope.linkId,
      url: scope.url,
      eligible: scope.eligible,
    })
    .from(scope)
    .innerJoin(taskTable, eq(taskTable.id, scope.id))
    .where(
      and(
        sql`${scope.linkId} is not null`,
        or(sql`not ${scope.eligible}`, scope.paused),
        after ? gt(scope.id, after) : undefined,
      ),
    )
    .orderBy(asc(scope.id))
    .limit(26);
  const selectedLabelIds =
    rules.outgoing.mode === "labels" ? rules.outgoing.labels : [];
  const previewToken = createHash("sha256")
    .update(
      JSON.stringify({
        integration: [integration.id, integration.config, integration.isActive],
        rules,
        labels: proposed.labels
          .filter((label) => selectedLabelIds.includes(label.id))
          .map(({ id, name }) => [id, name]),
        revision: impact!.revision,
      }),
    )
    .digest("hex");
  const { revision: _, ...counts } = impact!;
  return {
    isActive: integration.isActive === true,
    rules,
    labels: proposed.labels,
    missingLabels: proposed.missing,
    ...counts,
    matchingTasks,
    pausedNextCursor: pausedPage.length > 25 ? pausedPage[24]!.id : null,
    pausedTasks: pausedPage
      .slice(0, 25)
      .flatMap((task) =>
        task.linkId && task.url
          ? [{ ...task, linkId: task.linkId, url: task.url }]
          : [],
      ),
    previewToken,
  };
}
