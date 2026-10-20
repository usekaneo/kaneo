import { and, asc, gt, sql } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable } from "../../database/schema";
import { withJobLease } from "../../scheduler/leader-lock";
import { updateExternalLink } from "../github/services/link-manager";
import { canSyncTask } from "./eligibility";
import { syncLabelFieldsFromIssue } from "./sync-label-fields-from-issue";

const BATCH = 20;
let cursor: string | undefined;

/** Replays label reads that a webhook delivery could not finish. */
export function replayDeferredLabelFields() {
  return withJobLease(
    "deferred-label-fields",
    replayClaimedLabelFields,
    () => ({}),
  );
}

async function replayClaimedLabelFields() {
  let degraded = false;
  // Each read is bounded, so stopping here keeps the run inside its lease.
  const deadline = Date.now() + 45_000;
  const links = await db.query.externalLinkTable.findMany({
    where: and(
      sql`${externalLinkTable.resourceType} = 'issue' AND ${externalLinkTable.metadata} LIKE '%"syncLabelFieldsDeferred":"%'`,
      cursor ? gt(externalLinkTable.id, cursor) : undefined,
    ),
    with: { integration: true },
    orderBy: asc(externalLinkTable.id),
    limit: BATCH,
  });
  let finished = true;
  for (const link of links) {
    if (Date.now() >= deadline) {
      finished = false;
      break;
    }
    cursor = link.id;
    const integration = link.integration;
    try {
      if (
        !integration?.isActive ||
        !["github", "gitea"].includes(integration.type) ||
        !(await canSyncTask(
          link.taskId,
          integration.id,
          undefined,
          integration.config,
        ))
      ) {
        await updateExternalLink(link.id, {
          metadata: { syncLabelFieldsDeferred: null },
        });
        continue;
      }
      await syncLabelFieldsFromIssue(integration, link);
    } catch {
      degraded = true;
      console.error("Deferred issue label replay failed", { linkId: link.id });
    }
  }
  // Only a completed final batch starts the next run from the first link.
  if (finished && links.length < BATCH) cursor = undefined;
  return { degraded };
}
