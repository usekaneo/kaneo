import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { externalLinkTable } from "../../../database/schema";
import type { IntegrationDatabase } from "../../github/services/integration-task-scope";
import { parseDeferredIssueEdit } from "../../github/utils/deferred-issue-edit";
import { parseLinkMetadata } from "../../github/utils/parse-link-metadata";
import type { SyncStamp } from "../../github/utils/sync-echo";
import type { GiteaIssueSyncMode } from "../config";

// Call after updating the integration in the same transaction, so replay cannot
// observe the old mode with jobs that should no longer be delivered.
// Lock current metadata before deciding which links need changes; an unlocked
// snapshot could miss a concurrent job or overwrite a newly completed receipt.
export async function retireGiteaIssueEdits(
  integrationId: string,
  database: IntegrationDatabase,
  mode: GiteaIssueSyncMode,
): Promise<void> {
  const links = await database
    .select({ id: externalLinkTable.id, metadata: externalLinkTable.metadata })
    .from(externalLinkTable)
    .where(
      and(
        eq(externalLinkTable.integrationId, integrationId),
        eq(externalLinkTable.resourceType, "issue"),
      ),
    )
    .orderBy(externalLinkTable.id)
    .for("update");
  for (const link of links) {
    const metadata = parseLinkMetadata<
      Record<string, unknown> & { lastSync?: Record<string, SyncStamp> }
    >(link.metadata, {
      externalLinkId: link.id,
      source: "gitea_issue_mode_change",
    });

    const job = parseDeferredIssueEdit(metadata.deferredIssueEdit);
    let changed = false;
    if (job) {
      delete metadata.deferredIssueEdit;
      if (mode === "ingest-only" && job.fields.length) {
        metadata.deferredIssueEdit = {
          id: randomUUID(),
          scope: job.scope,
          fields: job.fields,
        };
      }
      changed = true;
    }

    if (metadata.lastSync) {
      for (const field of ["title", "description", "state"] as const) {
        const stamp = metadata.lastSync[field];
        if (
          !stamp?.outbound?.some(
            (entry) =>
              !entry.cancelled &&
              (entry.pending || entry.uncertain) &&
              entry.intentId,
          )
        )
          continue;
        metadata.lastSync[field] = {
          ...stamp,
          outbound: stamp.outbound.map((entry) =>
            !entry.cancelled &&
            (entry.pending || entry.uncertain) &&
            entry.intentId
              ? { ...entry, pending: false, uncertain: false, cancelled: true }
              : entry,
          ),
        };
        changed = true;
      }
    }
    if (changed) {
      await database
        .update(externalLinkTable)
        .set({ metadata: JSON.stringify(metadata) })
        .where(eq(externalLinkTable.id, link.id));
    }
  }
}
