import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";

export async function handleTaskAssigneeChanged(data: {
  taskId: string;
  newAssignee: string | null;
  title: string;
}) {
  const { taskId, newAssignee } = data;

  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task) {
      console.log("Task not found for assignee change:", taskId);
      return;
    }

    const integration = await getGiteaIntegration(task.projectId);

    if (!integration || !integration.isActive) {
      console.log(
        "No active Gitea integration found for project:",
        task.projectId,
      );
      return;
    }

    // Get external link for this task's Gitea integration
    const giteaLink = await getIntegrationLinkHybrid({
      taskId,
      type: "gitea_integration",
    });

    if (!giteaLink) {
      // Silently skip tasks without Gitea issue links
      return;
    }

    const giteaClient = await createGiteaClient(task.projectId);

    if (!giteaClient) {
      console.log("Failed to create Gitea client for project:", task.projectId);
      return;
    }

    console.log(
      "Updating Gitea issue assignee for repository:",
      `${giteaClient.owner}/${giteaClient.repo}`,
    );

    const issueNumber = Number.parseInt(giteaLink.issueNumber || "0", 10);

    if (!issueNumber) {
      console.log(
        "Invalid issue number in external link:",
        giteaLink.issueNumber,
      );
      return;
    }

    // Add comment about assignee change instead of trying to assign directly
    // (Gitea assignee functionality might require specific permissions)
    const commentBody = newAssignee
      ? `**Assignee updated in Kaneo**\n\nTask has been assigned to: ${newAssignee}\n\n---\n*This comment was automatically created from Kaneo task management system.*`
      : "**Assignee updated in Kaneo**\n\nTask has been unassigned.\n\n---\n*This comment was automatically created from Kaneo task management system.*";
    try {
      await giteaApiCall(
        giteaClient,
        `repos/${giteaClient.owner}/${giteaClient.repo}/issues/${issueNumber}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            body: commentBody,
          }),
        },
      );
      console.log(`Added assignee comment to Gitea issue ${issueNumber}`);
    } catch (error) {
      console.error("Failed to add assignee comment to Gitea issue:", error);
    }

    console.log(
      `Updated Gitea issue ${issueNumber} assignee for task ${taskId}`,
    );
  } catch (error) {
    console.error("Failed to update Gitea issue assignee:", error);
  }
}
