import { updateExternalLink } from "../github/services/link-manager";
import { isTaskInFinalState } from "../github/services/task-service";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";
import type { PluginContext, TaskCreatedEvent } from "../types";
import { createIssueWrite } from "./dispatch-issue-write";
import type { IssueWrite } from "./issue-write";
import { taskIssueLabels } from "./issue-labels";

type Initialization = {
  syncInitializationPending?: boolean;
  syncInitializedState?: boolean;
  syncInitializedLabels?: boolean;
  syncInitializedComment?: boolean;
};
type Link = { id: string; metadata?: string | null };

export function isIssueInitializationPending(link: Link) {
  return (
    parseLinkMetadata<Initialization>(link.metadata, {
      externalLinkId: link.id,
      source: "sync_creation",
    }).syncInitializationPending === true
  );
}

export async function initializeTaskIssue(
  event: TaskCreatedEvent,
  context: PluginContext,
  link: Link,
  actions: {
    close: () => Promise<unknown>;
    labels: (names: string[], write: IssueWrite) => Promise<void>;
    comment?: () => Promise<unknown>;
  },
) {
  const progress = parseLinkMetadata<Initialization>(link.metadata, {
    externalLinkId: link.id,
    source: "sync_creation",
  });
  const write = createIssueWrite(
    { ...link, taskId: event.taskId, integrationId: context.integrationId },
    JSON.stringify(context.config),
  );
  if (!progress.syncInitializedState) {
    if (
      await isTaskInFinalState({
        projectId: event.projectId,
        status: event.status,
        columnId: null,
      })
    ) {
      await write(actions.close);
      await updateExternalLink(link.id, {
        metadata: { state: "closed", lastOutboundStateSyncAt: Date.now() },
      });
    }
    await updateExternalLink(link.id, {
      metadata: { syncInitializedState: true },
    });
  }
  if (!progress.syncInitializedLabels) {
    await actions.labels(
      await taskIssueLabels(event.taskId, event.priority, event.status),
      write,
    );
    await updateExternalLink(link.id, {
      metadata: { syncInitializedLabels: true },
    });
  }
  if (!progress.syncInitializedComment && actions.comment) {
    await write(actions.comment);
    await updateExternalLink(link.id, {
      metadata: { syncInitializedComment: true },
    });
  }
  await updateExternalLink(link.id, {
    metadata: { syncInitializationPending: false },
  });
}
