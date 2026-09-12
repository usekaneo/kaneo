import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskTitleChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import {
  isEchoOf,
  parseLinkSyncMetadata,
  withLastSync,
} from "../utils/link-sync";

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    const metadata = parseLinkSyncMetadata(issueLink.metadata, {
      externalLinkId: issueLink.id,
      field: "title",
    });

    if (isEchoOf(metadata.lastSync?.title, "gitlab", event.newTitle)) {
      return;
    }

    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab title sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
      });
      return;
    }

    await createGitlabClient(config).updateIssue(config.projectPath, issueIid, {
      title: event.newTitle,
    });

    await updateExternalLink(issueLink.id, {
      title: event.newTitle,
      metadata: withLastSync(metadata, "title", "kaneo", event.newTitle),
    });
  } catch (error) {
    console.error("Failed to update GitLab issue title:", error);
  }
}
