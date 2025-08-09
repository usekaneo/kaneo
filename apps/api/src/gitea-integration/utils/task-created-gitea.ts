import { and, eq } from "drizzle-orm";
import db from "../../database";
import { externalLinksTable } from "../../database/schema";
import { createIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";
import { addLabelsToIssue, createGiteaLabels } from "./create-gitea-labels";
import { generateGiteaIssueBody } from "./issue-templates";

export async function handleTaskCreated(data: {
  taskId: string;
  userEmail: string | null;
  title: string;
  description: string | null;
  priority: string | null;
  status: string;
  projectId: string;
}) {
  const { taskId, userEmail, title, description, priority, status, projectId } =
    data;

  // Enhanced loop prevention: Skip if task was created from Gitea issue
  // Check if this task already has a Gitea integration link (indicating it came from Gitea)
  const giteaIntegrationCheck = await db.query.externalLinksTable.findFirst({
    where: and(
      eq(externalLinksTable.taskId, taskId),
      eq(externalLinksTable.type, "gitea_integration"),
    ),
  });

  if (giteaIntegrationCheck) {
    console.log(
      `Task ${taskId} already has Gitea integration link, skipping issue creation to prevent mirroring`,
    );
    return;
  }

  // Additional text-based loop prevention (for legacy compatibility)
  if (
    description?.includes("Created from Gitea issue") ||
    description?.includes("Imported from Gitea") ||
    title?.includes("(from Gitea)")
  ) {
    console.log(
      `Skipping Gitea issue creation for task ${taskId} - created from Gitea issue`,
    );
    return;
  }

  try {
    // Legacy check for additional safety
    if (
      title.startsWith("[Kaneo]") ||
      description?.includes("Linked to Gitea issue:")
    ) {
      console.log(
        "Skipping Gitea issue creation for task with Kaneo markers:",
        taskId,
      );
      return;
    }

    const client = await createGiteaClient(projectId);
    if (!client) {
      console.log("No Gitea integration configured for project:", projectId);
      return;
    }

    // Create issue in Gitea
    const statusDisplayNames: Record<string, string> = {
      "to-do": "To Do",
      "in-progress": "In Progress",
      "in-review": "In Review",
      done: "Done",
      archived: "Archived",
      planned: "Planned",
    };

    const statusDisplay = statusDisplayNames[status] || status;
    const shouldBeClosed = status === "done" || status === "archived";

    // Generate issue body using centralized template
    const issueBody = generateGiteaIssueBody(
      {
        taskId,
        title,
        description,
        status,
        priority,
        userEmail,
        action: "created",
      },
      {
        useBidirectionalDescriptions: true, // Set to false for Option 2 (visible markdown)
      },
    );

    const createdIssue = await giteaApiCall<{
      id: number;
      number: number;
      title: string;
      html_url: string;
    }>(client, `repos/${client.owner}/${client.repo}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: `[Kaneo] ${title}`,
        body: issueBody,
      }),
    });

    // Create and add labels (like GitHub)
    const labelsToAdd = [
      "kaneo",
      `priority:${priority || "low"}`,
      `status:${status}`,
    ];

    try {
      // Ensure labels exist in repository
      await createGiteaLabels(
        client.owner,
        client.repo,
        labelsToAdd,
        projectId,
      );

      // Add labels to the issue
      await addLabelsToIssue(
        client.owner,
        client.repo,
        createdIssue.number,
        labelsToAdd,
        projectId,
      );
    } catch (error) {
      console.error(
        `Failed to add labels to Gitea issue #${createdIssue.number}:`,
        error,
      );
    }

    // If the task status requires a closed issue, update it after creation
    if (shouldBeClosed) {
      try {
        await giteaApiCall(
          client,
          `repos/${client.owner}/${client.repo}/issues/${createdIssue.number}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              state: "closed",
            }),
          },
        );
        console.log(
          `Closed Gitea issue #${createdIssue.number} to match task status: ${statusDisplay}`,
        );
      } catch (error) {
        console.error(
          `Failed to close Gitea issue #${createdIssue.number}:`,
          error,
        );
      }
    }

    // Create external link to the Gitea issue instead of updating description
    await createIntegrationLinkHybrid({
      taskId,
      type: "gitea_integration",
      title: `Gitea Issue #${createdIssue.number}`,
      url: createdIssue.html_url,
      externalId: createdIssue.number.toString(),
    });

    console.log(
      `Created Gitea issue #${createdIssue.number} for task ${taskId} and linked via external_links`,
    );
  } catch (error) {
    console.error("Failed to create Gitea issue:", error);
  }
}
