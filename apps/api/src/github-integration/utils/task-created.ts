import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import getGithubIntegration from "../controllers/get-github-integration";
import createGithubApp from "./create-github-app";
import { addLabelsToIssue } from "./create-github-labels";

const githubApp = createGithubApp();

export async function handleTaskCreated(data: {
  taskId: string;
  userId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  number: number;
  projectId: string;
}) {
  if (!githubApp) {
    return;
  }

  const { taskId, userId, title, description, priority, status, projectId } =
    data;

  if (description?.includes("Created from GitHub issue:")) {
    console.log(
      "Skipping GitHub issue creation for task created from GitHub issue:",
      taskId,
    );
    return;
  }

  try {
    const integration = await getGithubIntegration(projectId);

    if (!integration || !integration.isActive) {
      console.log("No active GitHub integration found for project:", projectId);
      return;
    }

    const { repositoryOwner, repositoryName } = integration;
    console.log(
      "Creating GitHub issue for repository:",
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

    const createdIssue = await octokit.rest.issues.create({
      owner: repositoryOwner,
      repo: repositoryName,
      title: `[Kaneo] ${title}`,
      body: `**Task created in Kaneo**

**Description:** ${description || "No description provided"}

**Details:**
- Task ID: ${taskId}
- Status: ${status}
- Priority: ${priority || "Not set"}
- Assigned to: ${userId || "Unassigned"}

---
*This issue was automatically created from Kaneo task management system.*`,
    });

    const labelsToAdd = [
      "kaneo",
      `priority:${priority || "low"}`,
      `status:${status}`,
    ];
    await addLabelsToIssue(
      octokit,
      repositoryOwner,
      repositoryName,
      createdIssue.data.number,
      labelsToAdd,
    );

    try {
      await db
        .update(taskTable)
        .set({
          description: `${description || ""}

---

*Linked to GitHub issue: ${createdIssue.data.html_url}*`,
        })
        .where(eq(taskTable.id, taskId));
    } catch (error) {
      console.error(
        "Failed to update task description with GitHub issue link:",
        error,
      );
    }
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
  }
}
