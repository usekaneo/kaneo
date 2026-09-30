import { syncLatestTaskValue } from "../services/sync-latest-task-value";
import db from "../../../database";
import { linkedTaskScope } from "../services/integration-task-scope";
import type { PluginContext, TaskTitleChangedEvent } from "../../types";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";
import { findExternalLinksByTask } from "../services/link-manager";
import {
  getGithubApp,
  getVerifiedInstallationOctokit,
} from "../utils/github-app";

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const config = context.config as GitHubConfig;
  if (!hasVerifiedGitHubBinding(config)) return;
  const { repositoryOwner, repositoryName } = config;

  try {
    const current = await db.query.taskTable.findFirst({
      where: linkedTaskScope(event.taskId, context.projectId),
      columns: { title: true },
    });
    if (!current || current.title !== event.newTitle) return;

    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    const metadata = issueLink.metadata ? JSON.parse(issueLink.metadata) : {};

    // LOOP PREVENTION: Check if this update originated from GitHub
    const lastTitleSync = metadata.lastSync?.title;
    if (lastTitleSync) {
      // Skip if value unchanged and last sync was from GitHub
      if (
        lastTitleSync.value === event.newTitle &&
        lastTitleSync.source === "github"
      ) {
        console.log("Skipping title sync - already synced from GitHub");
        return;
      }
    }

    const octokit = await getVerifiedInstallationOctokit(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    await syncLatestTaskValue(
      event.taskId,
      context.projectId,
      issueLink,
      "title",
      event.newTitle,
      async (value) => {
        const response = await octokit.rest.issues.update({
          owner: repositoryOwner,
          repo: repositoryName,
          issue_number: issueNumber,
          title: value,
        });
        return response?.data?.updated_at;
      },
      async () =>
        (
          await octokit.rest.issues.get({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: issueNumber,
          })
        ).data.title,
      { type: "github", config: JSON.stringify(config) },
    );

    console.log(`Synced task title to GitHub issue #${issueNumber}`);
  } catch (error) {
    console.error("Failed to update GitHub issue title:", error);
  }
}
