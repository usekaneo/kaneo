import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { linkedTaskScope } from "../github/services/integration-task-scope";
import { updateExternalLink } from "../github/services/link-manager";
import { updateTaskStatus } from "../github/services/task-service";
import { withIntegrationLink } from "../github/services/with-integration-link";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";
import { changedLabelFields, isFieldLabel } from "./changed-label-fields";
import { withSyncLease } from "./lease";
import { SyncLeaseBusyError } from "./lease-busy-error";
import { providerIssue } from "./provider-issue";
import { isTransientProviderError } from "./transient-provider-error";

type Integration = {
  id: string;
  projectId: string;
  type: string;
  config: string;
};
type Link = { id: string; taskId: string; externalId: string };
type Metadata = {
  syncFieldLabels?: unknown;
  syncLabelFieldsDeferred?: unknown;
};

const metadataOf = (link: { id: string; metadata: string | null }) =>
  parseLinkMetadata<Metadata>(link.metadata, {
    externalLinkId: link.id,
    source: "label_fields",
  });

async function readLabels(integration: Integration, link: Link) {
  for (let attempt = 1; ; attempt++) {
    try {
      return (await (await providerIssue(integration, link)).read()).labels;
    } catch (error) {
      if (attempt === 3 || !isTransientProviderError(error)) throw error;
      await delay(250 * attempt);
    }
  }
}

async function applyLabelFields(
  integration: Integration,
  link: Link,
  labels: string[],
  deferred: unknown,
) {
  await withIntegrationLink(
    link,
    integration,
    async (tx, afterCommit, link) => {
      const task = await tx.query.taskTable.findFirst({
        where: linkedTaskScope(link.taskId, integration.projectId),
        columns: { status: true, priority: true },
      });
      if (!task) return;
      const metadata = metadataOf(link);
      const known = Array.isArray(metadata.syncFieldLabels)
        ? metadata.syncFieldLabels.filter((name) => typeof name === "string")
        : undefined;
      const { status, priority } = changedLabelFields(
        link,
        labels,
        known,
        task,
      );
      await updateExternalLink(
        link.id,
        {
          metadata: {
            syncFieldLabels: labels.filter(isFieldLabel),
            // A delivery deferred after this read began still needs its own.
            ...(deferred && metadata.syncLabelFieldsDeferred === deferred
              ? { syncLabelFieldsDeferred: null }
              : {}),
          },
        },
        tx,
      );

      if (priority) {
        await tx
          .update(taskTable)
          .set({ priority })
          .where(linkedTaskScope(link.taskId, integration.projectId));
        afterCommit(() =>
          publishEvent("task.updated", {
            projectId: integration.projectId,
            taskId: link.taskId,
          }),
        );
      }

      if (status) {
        const result = await updateTaskStatus(link.taskId, status, tx);
        if (result.applied && result.before.status !== result.after.status)
          afterCommit(() =>
            publishEvent("task.status_changed", {
              taskId: result.after.id,
              projectId: result.after.projectId,
              userId: null,
              oldStatus: result.before.status,
              newStatus: result.after.status,
              title: result.after.title,
              assigneeId: result.after.userId,
              type: "status_changed",
            }),
          );
      }
    },
  );
}

/**
 * Applies status and priority from the issue's current labels. Webhook label
 * snapshots can predate Kaneo's latest write, so applying them echoed old
 * values back (#1956). Reads under the lease outbound field-label sync holds
 * while it rewrites labels. When that lease stays busy or the provider fails
 * transiently, the scheduler replays the read instead of dropping it.
 */
export async function syncLabelFieldsFromIssue(
  integration: Integration,
  link: Link,
) {
  let defer = false;
  try {
    await withSyncLease(`sync-field-labels:${link.id}`, async () => {
      const stored = await db.query.externalLinkTable.findFirst({
        where: eq(externalLinkTable.id, link.id),
        columns: { id: true, metadata: true },
      });
      if (!stored) return;
      const deferred = metadataOf(stored).syncLabelFieldsDeferred;
      let labels: string[];
      try {
        labels = await readLabels(integration, link);
      } catch (error) {
        if (isTransientProviderError(error)) {
          defer = true;
          return;
        }
        console.error("Issue labels could not be read", {
          integrationId: integration.id,
          linkId: link.id,
        });
        // Replaying a permanent failure cannot succeed.
        if (deferred)
          await updateExternalLink(link.id, {
            metadata: { syncLabelFieldsDeferred: null },
          });
        return;
      }
      await applyLabelFields(integration, link, labels, deferred);
    });
  } catch (error) {
    if (!(error instanceof SyncLeaseBusyError)) throw error;
    defer = true;
  }
  if (defer)
    await updateExternalLink(link.id, {
      metadata: { syncLabelFieldsDeferred: randomUUID() },
    });
}
