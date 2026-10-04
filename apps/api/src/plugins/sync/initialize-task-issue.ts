import { updateExternalLink } from "../github/services/link-manager";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";
import type { PluginContext, TaskCreatedEvent } from "../types";
import { createIssueWrite } from "./dispatch-issue-write";
import { initializeTaskText } from "./initialize-task-text";
import { initializeTaskState } from "./initialize-task-state";

type Initialization = {
  syncInitializationPending?: boolean;
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
    text: (
      field: "title" | "description",
      value: string,
    ) => Promise<string | undefined>;
    state: (value: string) => Promise<string | undefined>;
    labels: () => Promise<string | undefined>;
    comment?: () => Promise<unknown>;
    commentExists?: () => Promise<boolean>;
  },
) {
  const current = await initializeTaskText(event, context, link, actions.text);
  const progress = parseLinkMetadata<Initialization>(link.metadata, {
    externalLinkId: link.id,
    source: "sync_creation",
  });
  const write = createIssueWrite(
    { ...link, taskId: event.taskId, integrationId: context.integrationId },
    JSON.stringify(context.config),
  );
  await initializeTaskState(current, context, link, actions.state);
  if (!progress.syncInitializedLabels) {
    if ((await actions.labels()) === undefined)
      throw new Error("Issue sync scope changed");
    await updateExternalLink(link.id, {
      metadata: { syncInitializedLabels: true },
    });
  }
  if (!progress.syncInitializedComment && actions.comment) {
    if (!(await actions.commentExists?.())) await write(actions.comment);
    await updateExternalLink(link.id, {
      metadata: { syncInitializedComment: true },
    });
  }
  await updateExternalLink(link.id, {
    metadata: { syncInitializationPending: false },
  });
}
