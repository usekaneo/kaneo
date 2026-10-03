import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
  );
  const current = await outgoingPredicate(
    integration.project.workspaceId,
    readSyncRules(integration.config)!.outgoing,
    database,
  );
  const rows = await database
    .selectDistinctOn([taskTable.id], {
      id: taskTable.id,
      eligible: proposed.predicate,
      current: current.predicate,
      linkId: externalLinkTable.id,
      url: externalLinkTable.url,
      paused: sql<boolean>`coalesce(${externalLinkTable.metadata} ~ '"syncFilterPaused"[[:space:]]*:[[:space:]]*true', false)`,
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
    .orderBy(
      asc(taskTable.id),
      desc(
        sql`coalesce(${externalLinkTable.metadata} ~ '"syncFilterPaused"[[:space:]]*:[[:space:]]*true', false)`,
      ),
      asc(externalLinkTable.id),
    );
  const matching = rows.filter((row) => row.eligible);
  const paused = rows.filter(
    (row) => row.linkId && (!row.eligible || row.paused),
  );
  const pausedPage = paused
    .filter((row) => !after || row.id > after)
    .slice(0, 26);
  const sampled = [
    ...new Set(
      [...matching.slice(0, 10), ...pausedPage.slice(0, 25)].map(
        (row) => row.id,
      ),
    ),
  ];
  const tasks = sampled.length
    ? await database
        .select({
          id: taskTable.id,
          number: taskTable.number,
          title: taskTable.title,
        })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.projectId, integration.projectId),
            inArray(taskTable.id, sampled),
          ),
        )
    : [];
  const samples = new Map(tasks.map((task) => [task.id, task]));
  const previewToken = createHash("sha256")
    .update(
      JSON.stringify({
        integration: [integration.id, integration.config, integration.isActive],
        rules,
        labels: proposed.labels,
        rows,
      }),
    )
    .digest("hex");
  return {
    isActive: integration.isActive === true,
    rules,
    labels: proposed.labels,
    missingLabels: proposed.missing,
    total: new Set(rows.map((row) => row.id)).size,
    matching: matching.length,
    willCreate: matching.filter((row) => !row.linkId).length,
    willPause: rows.filter((row) => row.linkId && !row.eligible && !row.paused)
      .length,
    needsReview: rows.filter(
      (row) => row.linkId && row.eligible && (row.paused || !row.current),
    ).length,
    paused: paused.length,
    matchingTasks: matching
      .slice(0, 10)
      .flatMap((row) => samples.get(row.id) ?? []),
    pausedNextCursor: pausedPage.length > 25 ? pausedPage[24]!.id : null,
    pausedTasks: pausedPage.slice(0, 25).flatMap((row) => {
      const task = samples.get(row.id);
      return task && row.linkId && row.url
        ? [
            {
              ...task,
              linkId: row.linkId,
              url: row.url,
              eligible: row.eligible,
            },
          ]
        : [];
    }),
    previewToken,
  };
}
