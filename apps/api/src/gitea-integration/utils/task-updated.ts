import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
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
      return;
    }

    const integration = await getGiteaIntegration(task.projectId);

    if (!integration || !integration.isActive) {
      return;
    }

    const hasKaneoLink = task.description?.includes("Linked to Gitea issue:");
    const hasGiteaLink = task.description?.includes(
      "Created from Gitea issue:",
    );

    if (!hasKaneoLink && !hasGiteaLink) {
      return;
    }

    const giteaClient = await createGiteaClient(task.projectId);

    if (!giteaClient) {
      return;
    }

    let giteaIssueUrlMatch = task.description?.match(
      new RegExp(
        `Linked to Gitea issue: (${giteaClient.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/]+/[^/]+/issues/\\d+)`,
      ),
    );

    if (!giteaIssueUrlMatch) {
      giteaIssueUrlMatch = task.description?.match(
        new RegExp(
          `Created from Gitea issue: (${giteaClient.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/]+/[^/]+/issues/\\d+)`,
        ),
      );
    }

    if (!giteaIssueUrlMatch) {
      return;
    }

    const giteaIssueUrl = giteaIssueUrlMatch[1];
    const issueNumber = Number.parseInt(
      giteaIssueUrl?.split("/").pop() || "0",
      10,
    );

    if (!issueNumber) {
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
      } catch (error) {
        console.error("Failed to update Gitea issue content:", error);
      }
    }
  } catch (error) {
    console.error("Failed to update Gitea issue content:", error);
  }
}
