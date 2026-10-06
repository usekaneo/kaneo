import type { IntegrationDatabase } from "./integration-task-scope";
import type { IssueField } from "../utils/deferred-issue-edit";
import { publishEvent } from "../../../events";
import { taskTable } from "../../../database/schema";
import { resolveTargetStatus as resolveGiteaStatus } from "../../gitea/utils/resolve-column";
import { resolveTargetStatus as resolveGithubStatus } from "../utils/resolve-column";
import {
  hasNewerObservedEdit,
  inboundStamp,
  type SyncStamp,
} from "../utils/sync-echo";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import {
  linkedTaskScope,
  integrationTaskRevision,
} from "./integration-task-scope";
import { withIntegrationLink } from "./with-integration-link";
import { updateExternalLink } from "./link-manager";
import { updateTaskStatus } from "./task-service";

// The observed matching value is durable even if the inbound HTTP request
// times out waiting for our response. Apply it only after version correlation.
export async function applyObservedTaskValue(
  link: { id: string; taskId: string },
  integration: { id: string; projectId: string; type: string },
  field: "title" | "description" | "state",
  value: string,
  intentId: string,
  updatedAt: string | undefined,
  expectedRevision: string,
  expectedBinding?: Parameters<typeof withIntegrationLink>[3],
) {
  return withIntegrationLink(
    link,
    integration,
    async (tx, afterCommit, locked) => {
      const metadata = parseLinkMetadata<
        Record<string, unknown> & { lastSync?: Record<string, SyncStamp> }
      >(locked.metadata, {
        externalLinkId: link.id,
        source: "observed_provider_edit",
      });
      const stamp = metadata.lastSync?.[field];
      if (
        (await integrationTaskRevision(
          link.taskId,
          integration.projectId,
          tx,
        )) !== expectedRevision
      )
        return false;
      if (
        !hasNewerObservedEdit(
          stamp?.outbound?.find((entry) => entry.intentId === intentId),
          updatedAt,
        )
      )
        return;
      await writeInboundTaskField(
        tx,
        afterCommit,
        link,
        integration,
        field,
        value,
      );
      await updateExternalLink(
        link.id,
        {
          metadata: {
            ...metadata,
            ...(field === "state" ? { state: value } : {}),
            lastSync: {
              ...metadata.lastSync,
              [field]: inboundStamp(
                stamp,
                value,
                integration.type,
                stamp?.outbound?.find((entry) => entry.intentId === intentId)
                  ?.observedUpdatedAt,
              ),
            },
          },
        },
        tx,
      );
      afterCommit(() =>
        publishEvent("task.updated", {
          taskId: link.taskId,
          projectId: integration.projectId,
          ...(field === "title" ? { titleChanged: true } : {}),
        }),
      );
      return true;
    },
    expectedBinding,
  );
}

export async function writeInboundTaskField(
  tx: IntegrationDatabase,
  afterCommit: (effect: () => Promise<void>) => void,
  link: { taskId: string },
  integration: { projectId: string; type: string },
  field: IssueField,
  value: string,
) {
  if (field === "state") {
    const resolveStatus =
      integration.type === "gitea" ? resolveGiteaStatus : resolveGithubStatus;
    const status = await resolveStatus(
      integration.projectId,
      value === "closed" ? "issue_closed" : "issue_reopened",
      value === "closed" ? "done" : "to-do",
      tx,
    );
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
  } else {
    await tx
      .update(taskTable)
      .set({ [field]: value })
      .where(linkedTaskScope(link.taskId, integration.projectId));
  }
}
