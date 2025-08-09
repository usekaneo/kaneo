import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";
import { cleanKaneoMetadata, generateGiteaIssueBody } from "./issue-templates";

export async function handleTaskUpdated(data: {
  taskId: string;
  userEmail: string | null;
  oldTitle?: string;
  newTitle?: string;
  oldDescription?: string;
  newDescription?: string;
  title: string;
  source?: string; // Add source tracking to prevent loops
}) {
  const { taskId, oldTitle, newTitle, oldDescription, newDescription, source } =
    data;

  // Skip if this update came from a Gitea webhook to prevent loops
  if (source === "gitea_webhook") {
    console.log(
      `Skipping Gitea update for task ${taskId} - source is gitea_webhook`,
    );
    return;
  }

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
      // More robust [Kaneo] prefix handling
      const kaneoPrefix = "[Kaneo] ";
      let cleanTitle = newTitle;

      // Remove any existing [Kaneo] prefix (case insensitive, flexible spacing)
      cleanTitle = cleanTitle.replace(/^\[Kaneo\]\s*/i, "");

      // Only add prefix if title doesn't already contain it
      updatePayload.title = `${kaneoPrefix}${cleanTitle}`;

      console.log(`Title update: "${oldTitle}" -> "${updatePayload.title}"`);
    }

    // Update description if changed
    if (oldDescription !== newDescription && newDescription !== undefined) {
      // Extract original description content (without any Kaneo metadata)
      const cleanDescription = cleanKaneoMetadata(newDescription);

      // Generate updated issue body using centralized template
      updatePayload.body = generateGiteaIssueBody(
        {
          taskId,
          title: task.title,
          description: cleanDescription,
          status: task.status,
          priority: task.priority,
          userEmail: task.userEmail,
          action: "updated",
        },
        {
          useBidirectionalDescriptions: true, // Set to false for Option 2 (visible markdown)
        },
      );
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
