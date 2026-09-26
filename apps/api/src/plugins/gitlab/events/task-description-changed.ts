import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatIssueBody } from "../../github/utils/format";
import type { PluginContext, TaskDescriptionChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import {
  isEchoOf,
  parseLinkSyncMetadata,
  withLastSync,
} from "../utils/link-sync";

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
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
      field: "description",
    });

    const newDescription = event.newDescription ?? "";

    if (isEchoOf(metadata.lastSync?.description, "gitlab", newDescription)) {
      return;
    }

    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab description sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
      });
      return;
    }

    const issueDescription = formatIssueBody(newDescription, event.taskId);

    await createGitlabClient(config).updateIssue(config.projectPath, issueIid, {
      description: issueDescription,
    });

    await updateExternalLink(issueLink.id, {
      metadata: withLastSync(
        metadata,
        "description",
        "kaneo",
        issueDescription,
      ),
    });
  } catch (error) {
    console.error("Failed to update GitLab issue description:", error);
  }
}
