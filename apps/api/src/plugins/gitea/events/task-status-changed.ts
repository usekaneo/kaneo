import { syncLatestTaskValue } from "../../github/services/sync-latest-task-value";
import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea, removeLabelGitea } from "../utils/labels";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GiteaConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

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

    const client = createGiteaClient(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    await removeLabelGitea(config, issueNumber, `status:${event.oldStatus}`);

    await addLabelsToIssueGitea(config, issueNumber, [
      `status:${event.newStatus}`,
    ]);

    if (event.newStatus === "done" || event.oldStatus === "done") {
      await syncLatestTaskValue(
        event.taskId,
        event.projectId,
        issueLink,
        "state",
        event.newStatus === "done" ? "closed" : "open",
        async (value) => {
          const response = await client.updateIssue(
            repositoryOwner,
            repositoryName,
            issueNumber,
            { state: value === "closed" ? "closed" : "open" },
          );
          return response?.updated_at;
        },
        async () =>
          (await client.getIssue(repositoryOwner, repositoryName, issueNumber))
            .state ?? "open",
        { type: "gitea", config: JSON.stringify(config) },
      );
    }
  } catch (error) {
    console.error("Failed to update Gitea issue status:", error);
  }
}
