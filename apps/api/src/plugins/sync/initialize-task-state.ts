import { updateExternalLink } from "../github/services/link-manager";
import { syncLatestTaskValue } from "../github/services/sync-latest-task-value";
import { isTaskInFinalState } from "../github/services/task-service";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";
import type { SyncStamp } from "../github/utils/sync-echo";
import type { PluginContext, TaskCreatedEvent } from "../types";

export async function initializeTaskState(
  event: TaskCreatedEvent,
  context: PluginContext,
  link: { id: string; metadata?: string | null },
  send: (value: string) => Promise<string | undefined>,
) {
  const progress = parseLinkMetadata<{
    state?: string;
    lastSync?: { state?: SyncStamp };
    syncInitializedState?: boolean;
  }>(link.metadata, { externalLinkId: link.id, source: "sync_initialization" });
  if (progress.syncInitializedState) return;
  const closing = await isTaskInFinalState({
    projectId: event.projectId,
    status: event.status,
    columnId: null,
  });
  // Retried closes may have reached the provider even when their response failed.
  if (
    closing ||
    progress.state === "closed" ||
    progress.lastSync?.state?.outbound?.length
  ) {
    try {
      const synchronized = await syncLatestTaskValue(
        event.taskId,
        event.projectId,
        { id: link.id, integrationId: context.integrationId },
        "state",
        closing ? "closed" : "open",
        send,
        undefined,
        { config: JSON.stringify(context.config) },
      );
      if (!synchronized) throw new Error("Issue state needs retry");
    } catch {
      console.error("Issue state initialization failed", {
        projectId: event.projectId,
        taskId: event.taskId,
        integrationId: context.integrationId,
        linkId: link.id,
      });
      throw new Error("Issue state initialization incomplete");
    }
  }
  await updateExternalLink(link.id, {
    metadata: { syncInitializedState: true },
  });
}
