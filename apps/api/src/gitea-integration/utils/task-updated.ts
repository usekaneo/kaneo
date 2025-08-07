import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";

export async function handleTaskUpdated(data: {
  taskId: string;
  userEmail: string | null;
  oldTitle?: string;
  newTitle?: string;
  oldDescription?: string;
  newDescription?: string;
  title: string;
}) {
  const { taskId, oldTitle, newTitle, oldDescription, newDescription } = data;

  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task) {
      console.log("Task not found for update:", taskId);
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
      "Updating Gitea issue content for repository:",
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

    // Prepare update payload
    const updatePayload: { title?: string; body?: string } = {};

    // Update title if changed
    if (oldTitle !== newTitle && newTitle) {
      updatePayload.title = `[Kaneo] ${newTitle}`;
    }

    // Update description if changed
    if (oldDescription !== newDescription && newDescription !== undefined) {
      // Extract original Gitea issue content and preserve it
      const originalPrefix = newDescription.includes(
        "**Task created in Kaneo**",
      )
        ? newDescription.split("**Task created in Kaneo**")[0]
        : newDescription.split(
            "---\n\n*This issue was automatically created from Kaneo task management system.*",
          )[0];

      updatePayload.body = `**Task updated in Kaneo**

**Description:** ${originalPrefix || "No description provided"}

**Details:**
- Task ID: ${taskId}
- Status: ${task.status}
- Priority: ${task.priority || "Not set"}
- Assigned to: ${task.userEmail || "Unassigned"}

---
*This issue was automatically updated from Kaneo task management system.*`;
    }

    // Only update if there are changes
    if (Object.keys(updatePayload).length > 0) {
      try {
        await giteaApiCall(
          giteaClient,
          `repos/${giteaClient.owner}/${giteaClient.repo}/issues/${issueNumber}`,
          {
            method: "PATCH",
            body: JSON.stringify(updatePayload),
          },
        );
        console.log(`Updated Gitea issue ${issueNumber} content`);
      } catch (error) {
        console.error("Failed to update Gitea issue content:", error);
      }
    }

    console.log(
      `Processed Gitea issue ${issueNumber} update for task ${taskId}`,
    );
  } catch (error) {
    console.error("Failed to update Gitea issue content:", error);
  }
}
