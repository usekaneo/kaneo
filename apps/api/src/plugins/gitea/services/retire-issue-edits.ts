import { and, eq } from "drizzle-orm";
import { externalLinkTable } from "../../../database/schema";
import type { IntegrationDatabase } from "../../github/services/integration-task-scope";
import { updateExternalLink } from "../../github/services/link-manager";
import { parseDeferredIssueEdit } from "../../github/utils/deferred-issue-edit";
import { parseLinkMetadata } from "../../github/utils/parse-link-metadata";
import type { SyncStamp } from "../../github/utils/sync-echo";
import type { GiteaIssueSyncMode } from "../config";

// Call after updating the integration in the same transaction, so replay cannot
// observe the old mode with jobs that should no longer be delivered.
export async function retireGiteaIssueEdits(
  integrationId: string,
  database: IntegrationDatabase,
  mode: GiteaIssueSyncMode,
): Promise<void> {
  const links = await database.query.externalLinkTable.findMany({
    where: and(
      eq(externalLinkTable.integrationId, integrationId),
      eq(externalLinkTable.resourceType, "issue"),
    ),
  });
  for (const link of links) {
    const metadata = parseLinkMetadata<
      Record<string, unknown> & { lastSync?: Record<string, SyncStamp> }
    >(link.metadata, {
      externalLinkId: link.id,
      source: "gitea_issue_mode_change",
    });
    const job = parseDeferredIssueEdit(metadata.deferredIssueEdit);
    if (job) {
      await updateExternalLink(
        link.id,
        { completeDeferredEdit: job.id },
        database,
      );
      // Finish the old job first so its repair fields cannot merge back in.
      if (mode === "ingest-only" && job.fields.length) {
        await updateExternalLink(
          link.id,
          {
            deferredEdit: { fields: job.fields, scope: job.scope },
          },
          database,
        );
      }
    }
    // Keep completed receipts, but cancel old uncertainty before a later switch
    // back to sync could turn an inbound delivery into an outbound repair.
    for (const field of ["title", "description", "state"] as const) {
      const intentIds =
        metadata.lastSync?.[field]?.outbound?.flatMap((entry) =>
          !entry.cancelled &&
          (entry.pending || entry.uncertain) &&
          entry.intentId
            ? [entry.intentId]
            : [],
        ) ?? [];
      if (intentIds.length) {
        await updateExternalLink(
          link.id,
          {
            retireOutboundIntents: { field, intentIds },
          },
          database,
        );
      }
    }
  }
}
