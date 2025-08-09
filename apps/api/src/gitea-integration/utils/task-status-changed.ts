import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";

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
      console.log("No Gitea integration link found for task:", taskId);
      return;
    }

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

    // Determine Gitea issue state and update description with status
    const shouldBeClosed = newStatus === "done" || newStatus === "archived";

    try {
      // Get current issue to preserve existing body
      const currentIssue: { body?: string } = await giteaApiCall(
        giteaClient,
        `repos/${giteaClient.owner}/${giteaClient.repo}/issues/${issueNumber}`,
        {
          method: "GET",
        },
      );

      let updatedBody = (currentIssue?.body as string) || "";

      // Define status display names
      const statusDisplayNames: Record<string, string> = {
        "to-do": "To Do",
        "in-progress": "In Progress",
        "in-review": "In Review",
        done: "Done",
        archived: "Archived",
        planned: "Planned",
      };

      const statusDisplay = statusDisplayNames[newStatus] || newStatus;

      // Parse the current body using the new template structure
      const templateRegex =
        /^([\s\S]*?)---\s*Task id on kaneo: ([^\n]+)\s*Status: ([^\n]+)\s*Priority: ([^\n]+)\s*Assignee: ([^\n]+)\s*Updated at: ([^\n]+)\s*$/;
      const match = updatedBody.match(templateRegex);

      if (match) {
        // Found existing template - preserve description, update metadata
        const [, description] = match;

        updatedBody = `${(description || "").trim()}

---
Task id on kaneo: ${taskId}
Status: ${statusDisplay}
Priority: ${task.priority || "Not set"}
Assignee: ${task.userEmail || "Unassigned"}
Updated at: ${new Date().toISOString()}`;
      } else {
        // No template found - clean old formats and add new template
        updatedBody = updatedBody
          // Remove old format variations
          .replace(/---\s*\*\*Task Status:\*\* [^\n]+/g, "")
          .replace(/---\s*\*\*Kaneo Status:\*\* [^\n]+/g, "")
          .replace(/\*\*Task Status:\*\* [^\n]+/g, "")
          .replace(/\*\*Kaneo Status:\*\* [^\n]+/g, "")
          .replace(
            /\*\*Details:\*\*[\s\S]*?---\s*\*This issue was automatically updated from Kaneo task management system\.\*/g,
            "",
          )
          .trim();

        updatedBody = `${updatedBody || "No description provided"}

---
Task id on kaneo: ${taskId}
Status: ${statusDisplay}
Priority: ${task.priority || "Not set"}
Assignee: ${task.userEmail || "Unassigned"}
Updated at: ${new Date().toISOString()}`;
      }

      // Update issue with new state and body
      await giteaApiCall(
        giteaClient,
        `repos/${giteaClient.owner}/${giteaClient.repo}/issues/${issueNumber}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            state: shouldBeClosed ? "closed" : "open",
            body: updatedBody,
          }),
        },
      );

      console.log(
        `Successfully updated Gitea issue ${issueNumber} - State: ${
          shouldBeClosed ? "closed" : "open"
        }, Status: ${statusDisplayNames[newStatus] || newStatus}`,
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
