import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GitHubConfig } from "../config";
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../services/link-manager";
import { addLabelsToIssue, removeLabel } from "../utils/labels";
import { getOctokitForConfig } from "../utils/octokit-for-config";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitHubConfig;
  const { repositoryOwner, repositoryName } = config;

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

    const octokit = await getOctokitForConfig(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    await removeLabel(
      octokit,
      repositoryOwner,
      repositoryName,
      issueNumber,
      `status:${event.oldStatus}`,
    );

    await addLabelsToIssue(
      octokit,
      repositoryOwner,
      repositoryName,
      issueNumber,
      [`status:${event.newStatus}`],
    );

    if (event.newStatus === "done") {
      await octokit.rest.issues.update({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        state: "closed",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "closed",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    } else if (event.oldStatus === "done" && event.newStatus !== "done") {
      await octokit.rest.issues.update({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        state: "open",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "open",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to update GitHub issue status:", error);
  }
}
