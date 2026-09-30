import { syncLatestTaskValue } from "../services/sync-latest-task-value";
import db from "../../../database";
import { linkedTaskScope } from "../services/integration-task-scope";
import type { PluginContext, TaskDescriptionChangedEvent } from "../../types";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";
import { findExternalLinksByTask } from "../services/link-manager";
import {
  formatIssueBody,
  formatTaskDescriptionFromIssue,
} from "../utils/format";
import {
  getGithubApp,
  getVerifiedInstallationOctokit,
} from "../utils/github-app";

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
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
      columns: { description: true },
    });
    if (
      !current ||
      (current.description || "") !== (event.newDescription || "")
    )
      return;

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
    const lastDescSync = metadata.lastSync?.description;
    const newDescNormalized = event.newDescription || "";

    if (lastDescSync) {
      // Skip if value unchanged and last sync was from GitHub
      if (
        lastDescSync.value === newDescNormalized &&
        lastDescSync.source === "github"
      ) {
        console.log("Skipping description sync - already synced from GitHub");
        return;
      }
    }

    const octokit = await getVerifiedInstallationOctokit(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    // Format description with task ID footer
    await syncLatestTaskValue(
      event.taskId,
      context.projectId,
      issueLink,
      "description",
      newDescNormalized,
      async (value) => {
        const response = await octokit.rest.issues.update({
          owner: repositoryOwner,
          repo: repositoryName,
          issue_number: issueNumber,
          body: formatIssueBody(value, event.taskId),
        });
        return response?.data?.updated_at;
      },
      async () =>
        formatTaskDescriptionFromIssue(
          (
            await octokit.rest.issues.get({
              owner: repositoryOwner,
              repo: repositoryName,
              issue_number: issueNumber,
            })
          ).data.body ?? null,
          event.taskId,
        ),
      { type: "github", config: JSON.stringify(config) },
    );

    console.log(`Synced task description to GitHub issue #${issueNumber}`);
  } catch (error) {
    console.error("Failed to update GitHub issue description:", error);
  }
}
