import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGithubIntegration from "../controllers/get-github-integration";
import createGithubApp from "./create-github-app";
import { addLabelsToIssue } from "./create-github-labels";

const githubApp = createGithubApp();

export async function handleTaskPriorityChanged(data: {
  taskId: string;
  userEmail: string | null;
  oldPriority: string;
  newPriority: string;
}) {
  if (!githubApp) {
    return;
  }

  const { taskId, oldPriority, newPriority } = data;

  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task) {
      console.log("Task not found for priority change:", taskId);
      return;
    }

    const integration = await getGithubIntegration(task.projectId);

    if (!integration || !integration.isActive) {
      console.log(
        "No active GitHub integration found for project:",
        task.projectId,
      );
      return;
    }

    const hasKaneoLink = task.description?.includes("Linked to GitHub issue:");
    const hasGitHubLink = task.description?.includes(
      "Created from GitHub issue:",
    );

    // Use hybrid approach - check both external_links and description
    const githubLink = await getIntegrationLinkHybrid({
      taskId,
      type: "github_integration",
    });

    if (!githubLink && !hasKaneoLink && !hasGitHubLink) {
      console.log(
        "Skipping GitHub issue update - task has no GitHub issue link:",
        taskId,
      );
      return;
    }

    const { repositoryOwner, repositoryName } = integration;
    console.log(
      "Updating GitHub issue priority for repository:",
      `${repositoryOwner}/${repositoryName}`,
    );

    let installationId = integration.installationId;

    if (!installationId) {
      const { data: installation } =
        await githubApp.octokit.rest.apps.getRepoInstallation({
          owner: repositoryOwner,
          repo: repositoryName,
        });
      installationId = installation.id;
    }

    const octokit = await githubApp.getInstallationOctokit(installationId);

    let issueNumber: number | null = null;

    // Try to get issue number from external_links first (preferred)
    if (githubLink) {
      issueNumber = Number.parseInt(githubLink.issueNumber || "0", 10);
    }

    // Fall back to description parsing for legacy compatibility
    if (!issueNumber) {
      let githubIssueUrlMatch = task.description?.match(
        /Linked to GitHub issue: (https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+)/,
      );

      if (!githubIssueUrlMatch) {
        githubIssueUrlMatch = task.description?.match(
          /Created from GitHub issue: (https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+)/,
        );
      }

      if (githubIssueUrlMatch) {
        const githubIssueUrl = githubIssueUrlMatch[1];
        issueNumber = Number.parseInt(
          githubIssueUrl?.split("/").pop() || "0",
          10,
        );
      }
    }

    if (!issueNumber) {
      console.log("Could not extract issue number for task:", taskId);
      return;
    }

    const labelsToAdd = [`priority:${newPriority}`];

    try {
      await octokit.rest.issues.removeLabel({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        name: `priority:${oldPriority}`,
      });
    } catch (error) {
      console.log("Could not remove old priority label:", error);
    }

    try {
      await addLabelsToIssue(
        octokit,
        repositoryOwner,
        repositoryName,
        issueNumber,
        labelsToAdd,
      );
    } catch (error) {
      console.error("Failed to add new priority label:", error);
    }

    console.log(
      `Updated GitHub issue ${issueNumber} priority from ${oldPriority} to ${newPriority}`,
    );
  } catch (error) {
    console.error("Failed to update GitHub issue priority:", error);
  }
}
