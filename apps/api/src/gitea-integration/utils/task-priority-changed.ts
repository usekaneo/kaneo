import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { replaceLabelsWithPrefix } from "./create-gitea-labels";

export async function handleTaskPriorityChanged(data: {
  taskId: string;
  userEmail: string | null;
  oldPriority: string;
  newPriority: string;
}) {
  const { taskId, oldPriority, newPriority } = data;

  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task) {
      console.log("Task not found for priority change:", taskId);
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
      console.log("No Gitea integration link found for task:", taskId);
      return;
    }

    const issueNumber = Number.parseInt(giteaLink.issueNumber || "0", 10);

    if (!issueNumber || !giteaLink.issueNumber) {
      console.log("Invalid issue number:", giteaLink.issueNumber);
      return;
    }

    console.log(
      `Updating Gitea issue ${issueNumber} priority from "${oldPriority}" to "${newPriority}" for task ${taskId}`,
    );

    const { repositoryOwner, repositoryName } = integration;

    try {
      // Replace all priority: labels with the new one (prevents duplicates)
      await replaceLabelsWithPrefix(
        repositoryOwner,
        repositoryName,
        issueNumber,
        "priority:",
        `priority:${newPriority}`,
        task.projectId,
      );

      console.log(
        `Successfully updated Gitea issue ${issueNumber} priority from ${oldPriority} to ${newPriority}`,
      );
    } catch (error) {
      console.error(
        `Failed to update Gitea issue ${issueNumber} priority:`,
        error,
      );
    }
  } catch (error) {
    console.error("Failed to handle task priority change:", error);
  }
}
