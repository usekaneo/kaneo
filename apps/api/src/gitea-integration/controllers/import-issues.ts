import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  externalLinksTable,
  giteaIntegrationTable,
  taskTable,
} from "../../database/schema";
import { createIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import { createGiteaClient, giteaApiCall } from "../utils/create-gitea-client";

interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  html_url: string;
  user: {
    login: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
}

export async function importIssues(projectId: string) {
  console.log("Starting import for project:", projectId);

  const giteaIntegration = await db.query.giteaIntegrationTable.findFirst({
    where: eq(giteaIntegrationTable.projectId, projectId),
  });

  if (!giteaIntegration) {
    console.log("No Gitea integration found for project:", projectId);
    return { error: "Gitea integration not found" };
  }

  console.log("Found integration:", {
    url: giteaIntegration.giteaUrl,
    owner: giteaIntegration.repositoryOwner,
    repo: giteaIntegration.repositoryName,
    hasToken: !!giteaIntegration.accessToken,
  });

  const client = await createGiteaClient(projectId);

  if (!client) {
    console.log("Failed to create Gitea client");
    return { error: "Failed to create Gitea client" };
  }

  try {
    console.log(
      "Fetching issues from:",
      `repos/${client.owner}/${client.repo}/issues?state=all&type=issues`,
    );

    const issues = await giteaApiCall<GiteaIssue[]>(
      client,
      `repos/${client.owner}/${client.repo}/issues?state=all&type=issues`,
    );

    console.log("Fetched issues:", issues?.length || 0);
    console.log("Issues data:", issues);

    let imported = 0;
    let skipped = 0;

    for (const issue of issues || []) {
      console.log("Processing issue:", issue.number, issue.title);

      // Check if task already exists via external link (new system)
      const existingExternalLink = await db.query.externalLinksTable.findFirst({
        where: and(
          eq(externalLinksTable.type, "gitea_integration"),
          eq(externalLinksTable.externalId, issue.number.toString()),
        ),
      });

      if (existingExternalLink) {
        // Verify the task belongs to this project
        const linkedTask = await db.query.taskTable.findFirst({
          where: and(
            eq(taskTable.id, existingExternalLink.taskId),
            eq(taskTable.projectId, projectId),
          ),
        });

        if (linkedTask) {
          console.log(
            "Gitea issue already imported via external link, skipping:",
            issue.number,
          );
          console.log("Existing task details:", {
            id: linkedTask.id,
            title: linkedTask.title,
            number: linkedTask.number,
          });
          skipped++;
          continue;
        }
      }

      // Also check for legacy description-based imports to avoid duplicates
      const existingLegacyTask = await db.query.taskTable.findFirst({
        where: and(
          eq(taskTable.number, issue.number),
          eq(taskTable.projectId, projectId),
        ),
      });

      if (existingLegacyTask?.description?.includes("Linked to Gitea issue:")) {
        console.log(
          "Gitea issue already imported (legacy), skipping:",
          issue.number,
        );
        skipped++;
        continue;
      }

      const giteaIssueUrl = issue.html_url;
      // Clean description - don't add old-style link footer anymore
      const description = issue.body || "No description provided";

      // Map Gitea issue state to task status
      const status = issue.state === "open" ? "to-do" : "done";

      console.log("Creating task:", {
        title: issue.title,
        number: issue.number,
        status,
        projectId,
      });

      const [createdTask] = await db
        .insert(taskTable)
        .values({
          title: issue.title,
          description,
          projectId,
          number: issue.number,
          status,
          priority: "low", // Default priority, could be enhanced to parse from labels
          position: 0,
          createdAt: new Date(issue.created_at),
        })
        .returning();

      if (!createdTask) {
        console.error("Failed to create task for issue:", issue.number);
        continue;
      }

      // Create external link for the imported issue
      await createIntegrationLinkHybrid({
        taskId: createdTask.id,
        type: "gitea_integration",
        title: `Gitea Issue #${issue.number}`,
        url: giteaIssueUrl,
        externalId: issue.number.toString(),
      });

      console.log(
        "Task created successfully for issue:",
        issue.number,
        "with external link",
      );
      imported++;
    }

    console.log("Import completed:", { imported, skipped });

    return {
      success: true,
      message: `Issues imported successfully. ${imported} imported, ${skipped} skipped.`,
      imported,
      skipped,
    };
  } catch (error) {
    console.error("Import error:", error);
    return {
      error: `Failed to import issues: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
