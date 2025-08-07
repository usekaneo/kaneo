import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";

export async function handleTaskPriorityChanged(data: {
  taskId: string;
  userEmail: string | null;
  oldPriority: string;
  newPriority: string;
}) {
  const { taskId, newPriority } = data;

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

    // Add comment about priority change
    const commentBody = `**Priority updated in Kaneo**\n\nTask priority changed to: **${newPriority}**\n\n---\n*This comment was automatically created from Kaneo task management system.*`;

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
    } catch (error) {
      console.error("Failed to add priority comment to Gitea issue:", error);
    }
  } catch (error) {
    console.error("Failed to update Gitea issue priority:", error);
  }
}
