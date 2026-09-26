import {
  findExternalLinkByTaskAndType,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { parseLinkSyncMetadata } from "../utils/link-sync";
import { syncedNoteIds, withSyncedNoteId } from "../utils/synced-notes";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const existingLink = await findExternalLinkByTaskAndType(
    event.taskId,
    context.integrationId,
    "issue",
  );

  if (!existingLink) {
    return;
  }

  if (!/^\d+$/.test(existingLink.externalId)) {
    console.error(
      "Skipping GitLab comment sync for invalid external issue id",
      {
        taskId: event.taskId,
        externalId: existingLink.externalId,
      },
    );
    return;
  }

  const issueIid = Number(existingLink.externalId);

  if (!Number.isFinite(issueIid) || issueIid < 1) {
    console.error("Skipping GitLab comment sync for invalid issue iid", {
      taskId: event.taskId,
      externalId: existingLink.externalId,
    });
    return;
  }

  try {
    const note = await createGitlabClient(config).createIssueNote(
      config.projectPath,
      issueIid,
      event.comment,
    );

    const metadata = parseLinkSyncMetadata(existingLink.metadata, {
      externalLinkId: existingLink.id,
      field: "syncedNoteIds",
    });

    await updateExternalLink(existingLink.id, {
      metadata: {
        ...metadata,
        syncedNoteIds: withSyncedNoteId(
          syncedNoteIds(existingLink.metadata),
          note.id,
        ),
      },
    });
  } catch (error) {
    console.error("Failed to create GitLab comment:", error);
  }
}
