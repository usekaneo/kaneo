/**
 * @fileoverview Gitea Issues Import Controller
 * Handles bulk import of issues from Gitea repositories into Kaneo tasks
 * with duplicate prevention and bidirectional synchronization support
 */

import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  externalLinksTable,
  giteaIntegrationTable,
  taskTable,
} from "../../database/schema";
import { createIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import { createGiteaClient, giteaApiCall } from "../utils/create-gitea-client";

/**
 * Gitea issue structure from API response
 * @interface GiteaIssue
 *
 * @example API Response
 * ```json
 * {
 *   "id": 1,
 *   "number": 42,
 *   "title": "Fix authentication bug",
 *   "body": "User login fails on mobile devices...",
 *   "state": "open",
 *   "html_url": "https://gitea.example.com/user/repo/issues/42",
 *   "user": { "login": "developer" },
 *   "labels": [{ "name": "bug", "color": "ff0000" }]
 * }
 * ```
 */
interface GiteaIssue {
  /** Unique issue ID from Gitea */
  id: number;
  /** Issue number (#42) */
  number: number;
  /** Issue title */
  title: string;
  /** Issue description/body content */
  body: string;
  /** Issue state: open or closed */
  state: "open" | "closed";
  /** ISO timestamp of issue creation */
  created_at: string;
  /** ISO timestamp of last update */
  updated_at: string;
  /** Full URL to the issue on Gitea */
  html_url: string;
  /** Issue author information */
  user: {
    /** Username of issue creator */
    login: string;
  };
  /** Attached labels with names and colors */
  labels: Array<{
    /** Label name (e.g., "bug", "enhancement") */
    name: string;
    /** Hex color code without # */
    color: string;
  }>;
}

/**
 * Import configuration for performance optimization
 * @todo Implement batch processing for large imports
 */
// const IMPORT_CONFIG = {
//   /** Maximum issues to fetch per API call */
//   batchSize: 50,
//   /** Timeout for individual API calls (ms) */
//   apiTimeout: 10000,
//   /** Maximum concurrent duplicate checks */
//   maxConcurrentChecks: 10,
// } as const;

/**
 * Import issues from Gitea repository with performance optimization
 * and comprehensive duplicate prevention
 *
 * @param projectId - Kaneo project ID to import issues into
 * @returns Import result with statistics and error handling
 *
 * @example Basic import
 * ```typescript
 * const result = await importIssues("project_123");
 * if (result.error) {
 *   console.error("Import failed:", result.error);
 * } else {
 *   console.log(`Imported ${result.imported} issues, skipped ${result.skipped} duplicates`);
 * }
 * ```
 *
 * @throws {Error} Database connection or API communication errors
 */

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

    // Batch fetch all existing external links for this project to optimize duplicate detection
    const existingLinks = await db
      .select({
        externalId: externalLinksTable.externalId,
        taskId: externalLinksTable.taskId,
        taskTitle: taskTable.title,
        taskNumber: taskTable.number,
      })
      .from(externalLinksTable)
      .innerJoin(taskTable, eq(externalLinksTable.taskId, taskTable.id))
      .where(
        and(
          eq(externalLinksTable.type, "gitea_integration"),
          eq(taskTable.projectId, projectId),
        ),
      );

    // Create lookup map for O(1) duplicate detection
    const linkMap = new Map(
      existingLinks.map((link) => [link.externalId, link]),
    );

    console.log(
      `Pre-loaded ${existingLinks.length} existing links for duplicate detection`,
    );

    for (const issue of issues || []) {
      console.log("Processing issue:", issue.number, issue.title);

      // Optimized duplicate check using pre-loaded map
      const existingLink = linkMap.get(issue.number.toString());
      if (existingLink) {
        console.log(
          "Gitea issue already imported via external link, skipping:",
          issue.number,
        );
        console.log("Existing task details:", {
          id: existingLink.taskId,
          title: existingLink.taskTitle,
          number: existingLink.taskNumber,
        });
        skipped++;
        continue;
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
