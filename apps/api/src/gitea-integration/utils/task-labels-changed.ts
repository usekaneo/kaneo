import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { getIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import getGiteaIntegration from "../controllers/get-gitea-integration";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";

interface GiteaLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

export async function handleTaskLabelsChanged(data: {
  taskId: string;
  userEmail: string | null;
  labels: Array<{ name: string; color: string }>;
  title: string;
}) {
  const { taskId, labels } = data;

  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task) {
      console.log("Task not found for label change:", taskId);
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
      "Updating Gitea issue labels for repository:",
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

    // Get current labels from Gitea issue
    const currentLabels = await giteaApiCall<GiteaLabel[]>(
      giteaClient,
      `repos/${giteaClient.owner}/${giteaClient.repo}/issues/${issueNumber}/labels`,
    );

    // Filter out Kaneo labels (keep system labels like priority:, status:, kaneo)
    const systemLabels = currentLabels.filter(
      (label) =>
        label.name.startsWith("priority:") ||
        label.name.startsWith("status:") ||
        label.name === "kaneo",
    );

    // Prepare new label set: system labels + Kaneo task labels
    const newLabels = [
      ...systemLabels.map((label) => ({
        name: label.name,
        color: label.color,
      })),
      ...labels.map((label) => ({
        name: `kaneo:${label.name}`,
        color: label.color.replace("#", ""),
      })),
    ];

    // Create labels that don't exist in Gitea
    for (const label of newLabels) {
      if (!systemLabels.some((existing) => existing.name === label.name)) {
        try {
          await giteaApiCall(
            giteaClient,
            `repos/${giteaClient.owner}/${giteaClient.repo}/labels`,
            {
              method: "POST",
              body: JSON.stringify({
                name: label.name,
                color: label.color,
                description: `Kaneo task label: ${label.name.replace("kaneo:", "")}`,
              }),
            },
          );
          console.log(`Created Gitea label: ${label.name}`);
        } catch (error) {
          // Label might already exist, ignore error
          console.log(`Label ${label.name} might already exist:`, error);
        }
      }
    }

    // Update issue with new labels
    try {
      await giteaApiCall(
        giteaClient,
        `repos/${giteaClient.owner}/${giteaClient.repo}/issues/${issueNumber}/labels`,
        {
          method: "PUT",
          body: JSON.stringify({
            labels: newLabels.map((label) => label.name),
          }),
        },
      );
      console.log(`Updated Gitea issue ${issueNumber} labels`);
    } catch (error) {
      console.error("Failed to update Gitea issue labels:", error);
    }

    console.log(`Updated Gitea issue ${issueNumber} labels for task ${taskId}`);
  } catch (error) {
    console.error("Failed to update Gitea issue labels:", error);
  }
}
