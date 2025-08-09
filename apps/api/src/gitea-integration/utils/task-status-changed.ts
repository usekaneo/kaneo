import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";
import { replaceLabelsWithPrefix } from "./create-gitea-labels";

export async function handleTaskStatusChanged(data: {
  taskId: string;
  userEmail: string | null;
  oldStatus: string;
  newStatus: string;
}) {
  const { taskId, oldStatus, newStatus } = data;

  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task) {
      console.log("Task not found for status update:", taskId);
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
      console.log(
        `No Gitea integration link found for task: ${taskId} (status change ${oldStatus} -> ${newStatus})`,
      );
      return;
    }

    console.log(
      `Found Gitea link for task ${taskId}: issue #${giteaLink.issueNumber} (source: ${giteaLink.source})`,
    );

    const giteaClient = await createGiteaClient(task.projectId);

    if (!giteaClient) {
      console.log("Failed to create Gitea client for project:", task.projectId);
      return;
    }

    const issueNumber = Number.parseInt(giteaLink.issueNumber || "0", 10);

    if (!issueNumber || !giteaLink.issueNumber) {
      console.log("Invalid issue number:", giteaLink.issueNumber);
      return;
    }

    console.log(
      `Updating Gitea issue ${issueNumber} status from "${oldStatus}" to "${newStatus}" for task ${taskId}`,
    );

    // Determine Gitea issue state (GitHub-style: only update state, not body)
    const shouldBeClosed = newStatus === "done" || newStatus === "archived";

    try {
      // Replace all status: labels with the new one (prevents duplicates)
      await replaceLabelsWithPrefix(
        giteaClient.owner,
        giteaClient.repo,
        issueNumber,
        "status:",
        `status:${newStatus}`,
        task.projectId,
      );

      // Update issue state (GitHub-style: only update state, not body)
      await giteaApiCall(
        giteaClient,
        `repos/${giteaClient.owner}/${giteaClient.repo}/issues/${issueNumber}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            state: shouldBeClosed ? "closed" : "open",
          }),
        },
      );

      console.log(
        `Successfully updated Gitea issue ${issueNumber} state to: ${
          shouldBeClosed ? "closed" : "open"
        } (status: ${newStatus})`,
      );
    } catch (error) {
      console.error(
        `Failed to update Gitea issue ${issueNumber} status:`,
        error,
      );
    }
  } catch (error) {
    console.error("Failed to handle task status change:", error);
  }
}
