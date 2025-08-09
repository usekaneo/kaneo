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
      // Extract original description content (without any Kaneo metadata)
      let cleanDescription = newDescription;

      // Remove all old format variations - comprehensive cleaning
      cleanDescription = cleanDescription
        // Remove new structured template format
        .replace(
          /---\s*Task id on kaneo: [^\n]+\s*Status: [^\n]+\s*Priority: [^\n]+\s*Assignee: [^\n]+\s*Updated at: [^\n]+\s*$/g,
          "",
        )
        // Remove legacy formats with Task Status
        .replace(
          /---\s*\*\*Task Status:\*\* [^\n]+\s*\*\*Details:\*\*[\s\S]*?---\s*\*This issue was automatically updated from Kaneo task management system\.\*\s*$/g,
          "",
        )
        // Remove legacy formats with Kaneo Status
        .replace(
          /---\s*\*\*Kaneo Status:\*\* [^\n]+\s*\*\*Details:\*\*[\s\S]*?---\s*\*This issue was automatically updated from Kaneo task management system\.\*\s*$/g,
          "",
        )
        // Remove very old legacy formats
        .replace(
          /\*\*Task (created|updated) in Kaneo\*\*[\s\S]*?---\s*\*This issue was automatically (created|updated) from Kaneo task management system\.\*\s*$/g,
          "",
        )
        // Remove standalone status lines
        .replace(/---\s*\*\*Task Status:\*\* [^\n]+/g, "")
        .replace(/---\s*\*\*Kaneo Status:\*\* [^\n]+/g, "")
        .replace(/\*\*Task Status:\*\* [^\n]+/g, "")
        .replace(/\*\*Kaneo Status:\*\* [^\n]+/g, "")
        // Clean up legacy link patterns (should not be in description anymore with external links)
        .replace(/\*Linked to Gitea issue: [^\*]+\*/g, "")
        .replace(/\*Created from Gitea issue: [^\*]+\*/g, "")
        .trim();

      // Build status display using the new template format
      const statusDisplayNames: Record<string, string> = {
        "to-do": "To Do",
        "in-progress": "In Progress",
        "in-review": "In Review",
        done: "Done",
        archived: "Archived",
        planned: "Planned",
      };

      const statusDisplay = statusDisplayNames[task.status] || task.status;

      // Use the new structured template format
      updatePayload.body = `${cleanDescription || "No description provided"}

---
Task id on kaneo: ${taskId}
Status: ${statusDisplay}
Priority: ${task.priority || "Not set"}
Assignee: ${task.userEmail || "Unassigned"}
Updated at: ${new Date().toISOString()}`;
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
