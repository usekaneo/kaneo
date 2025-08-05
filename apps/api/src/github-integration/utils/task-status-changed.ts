import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import getGithubIntegration from "../controllers/get-github-integration";
import createGithubApp from "./create-github-app";
import { addLabelsToIssue } from "./create-github-labels";

const githubApp = createGithubApp();

export async function handleTaskStatusChanged(data: {
  taskId: string;
  userEmail: string | null;
  oldStatus: string;
  newStatus: string;
}) {
  if (!githubApp) {
    return;
  }

  const { taskId, oldStatus, newStatus } = data;

  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task) {
      console.log("Task not found for status change:", taskId);
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

    if (!hasKaneoLink && !hasGitHubLink) {
      console.log(
        "Skipping GitHub issue update - task has no GitHub issue link:",
        taskId,
      );
      return;
    }

    const { repositoryOwner, repositoryName } = integration;
    console.log(
      "Updating GitHub issue status for repository:",
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

    let githubIssueUrlMatch = task.description?.match(
      /Linked to GitHub issue: (https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+)/,
    );

    if (!githubIssueUrlMatch) {
      githubIssueUrlMatch = task.description?.match(
        /Created from GitHub issue: (https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+)/,
      );
    }

    if (!githubIssueUrlMatch) {
      console.log("GitHub issue URL not found in task description:", taskId);
      return;
    }

    const githubIssueUrl = githubIssueUrlMatch[1];
    const issueNumber = Number.parseInt(
      githubIssueUrl?.split("/").pop() || "0",
      10,
    );

    if (!issueNumber) {
      console.log("Could not extract issue number from URL:", githubIssueUrl);
      return;
    }

    const labelsToAdd = [`status:${newStatus}`];

    try {
      await octokit.rest.issues.removeLabel({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        name: `status:${oldStatus}`,
      });
    } catch (error) {
      console.log("Could not remove old status label:", error);
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
      console.error("Failed to add new status label:", error);
    }

    if (newStatus === "done") {
      try {
        await octokit.rest.issues.update({
          owner: repositoryOwner,
          repo: repositoryName,
          issue_number: issueNumber,
          state: "closed",
        });
        console.log(`Closed GitHub issue ${issueNumber}`);
      } catch (error) {
        console.error("Failed to close GitHub issue:", error);
      }
    } else if (oldStatus === "done" && newStatus !== "done") {
      try {
        await octokit.rest.issues.update({
          owner: repositoryOwner,
          repo: repositoryName,
          issue_number: issueNumber,
          state: "open",
        });
        console.log(`Reopened GitHub issue ${issueNumber}`);
      } catch (error) {
        console.error("Failed to reopen GitHub issue:", error);
      }
    }

    console.log(
      `Updated GitHub issue ${issueNumber} status from ${oldStatus} to ${newStatus}`,
    );
  } catch (error) {
    console.error("Failed to update GitHub issue status:", error);
  }
}
