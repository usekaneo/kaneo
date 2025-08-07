import { eq } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
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
        } catch (error) {
          // Label might already exist, ignore error
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
    } catch (error) {
      console.error("Failed to update Gitea issue labels:", error);
    }
  } catch (error) {
    console.error("Failed to update Gitea issue labels:", error);
  }
}
