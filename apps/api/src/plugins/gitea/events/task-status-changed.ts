import { syncLatestTaskValue } from "../../github/services/sync-latest-task-value";
import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import { canSyncGiteaIssues, type GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea, removeLabelGitea } from "../utils/labels";
import { withGiteaOutboundWrite } from "../services/outbound-fence";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GiteaConfig;
  if (!canSyncGiteaIssues(config) || !config.baseUrl || !config.accessToken) {
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

    const binding = {
      integrationId: context.integrationId,
      projectId: context.projectId,
      config,
      link: issueLink,
    };
    const removed = await removeLabelGitea(
      binding,
      issueNumber,
      `status:${event.oldStatus}`,
    );
    if (removed.outcome === "skipped") return;
    const added = await addLabelsToIssueGitea(binding, issueNumber, [
      `status:${event.newStatus}`,
    ]);
    if (added.outcome === "skipped") return;

    if (event.newStatus === "done" || event.oldStatus === "done") {
      await syncLatestTaskValue(
        event.taskId,
        event.projectId,
        issueLink,
        "state",
        event.newStatus === "done" ? "closed" : "open",
        async (value, intentId) => {
          const result = await withGiteaOutboundWrite(
            { ...binding, intent: { field: "state", intentId } },
            () =>
              client.updateIssue(repositoryOwner, repositoryName, issueNumber, {
                state: value === "closed" ? "closed" : "open",
              }),
          );
          return result.sent
            ? { sent: true, updatedAt: result.value.updated_at }
            : result;
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
