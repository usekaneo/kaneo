import { and, eq, like } from "drizzle-orm";
import db from "../../database";
import { taskTable } from "../../database/schema";
import createTask from "../../task/controllers/create-task";
import { createGiteaClient, giteaApiCall } from "../utils/create-gitea-client";
import { extractIssuePriority } from "../utils/extract-issue-priority";
import getGiteaIntegration from "./get-gitea-integration";

export async function importIssues(projectId: string) {
  try {
    const integration = await getGiteaIntegration(projectId);

    if (!integration) {
      throw new Error("No Gitea integration found for this project");
    }

    const client = await createGiteaClient(projectId);
    if (!client) {
      throw new Error("Failed to create Gitea client");
    }

    // Fetch open issues from Gitea
    const issues = await giteaApiCall<
      Array<{
        id: number;
        number: number;
        title: string;
        body: string;
        state: string;
        created_at: string;
        updated_at: string;
        html_url: string;
        user: {
          login: string;
          email?: string;
        };
        labels: Array<{
          name: string;
          color: string;
        }>;
      }>
    >(
      client,
      `repos/${client.owner}/${client.repo}/issues?state=all&sort=created&direction=desc`,
    );

    if (!issues || issues.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;

    for (const issue of issues) {
      // Check if this issue was already imported
      const existingTask = await db.query.taskTable.findFirst({
        where: and(
          eq(taskTable.projectId, projectId),
          like(taskTable.description, "%Linked to Gitea issue:%"),
          like(taskTable.description, `%${issue.html_url}%`),
        ),
      });

      if (existingTask) {
        skipped++;
        continue;
      }

      // Extract priority from labels
      const priority = extractIssuePriority(issue.labels);
      const status = issue.state === "closed" ? "done" : "to-do";

      // Create task description with Gitea issue link
      const description = `${issue.body || "No description provided"}

---

*Created from Gitea issue: ${issue.html_url}*`;

      // Create the task
      await createTask({
        title: issue.title,
        description,
        status,
        priority,
        projectId,
        userEmail: issue.user.email || issue.user.login,
        dueDate: new Date(),
      });

      imported++;
    }

    return { imported, skipped };
  } catch (error) {
    console.error("Failed to import issues from Gitea:", error);
    throw new Error(
      `Failed to import issues: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
