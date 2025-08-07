import { createIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import { createGiteaClient, giteaApiCall } from "./create-gitea-client";

export async function handleTaskCreated({
  taskId,
  userEmail,
  title,
  description,
  priority,
  status,
  number,
  projectId,
}: {
  taskId: string;
  userEmail: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  number: number;
  projectId: string;
}) {
  try {
    // Check if this task was already created from a Gitea issue (to avoid infinite loops)
    if (
      title.startsWith("[Kaneo]") ||
      description?.includes("Linked to Gitea issue:")
    ) {
      console.log(
        "Skipping Gitea issue creation for task created from Gitea issue:",
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
    const issueBody = `**Task created in Kaneo**

**Description:** ${description || "No description provided"}

**Details:**
- Task ID: ${taskId}
- Status: ${status}
- Priority: ${priority || "Not set"}
- Assigned to: ${userEmail || "Unassigned"}

---
*This issue was automatically created from Kaneo task management system.*`;

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

    // Create external link to the Gitea issue instead of updating description
    await createIntegrationLinkHybrid({
      taskId,
      type: "gitea_integration",
      title: `Gitea Issue #${createdIssue.number}`,
      url: createdIssue.html_url,
      externalId: createdIssue.number.toString(),
    });

    console.log(
      `Created Gitea issue #${createdIssue.number} for task ${number} (${taskId}) and linked via external_links`,
    );
  } catch (error) {
    console.error("Failed to create Gitea issue:", error);
  }
}
