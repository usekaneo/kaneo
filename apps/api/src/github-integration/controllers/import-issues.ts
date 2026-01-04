import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  integrationTable,
  labelTable,
  taskTable,
} from "../../database/schema";
import {
  createExternalLink,
  findExternalLink,
} from "../../plugins/github/services/link-manager";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import { getGithubApp } from "../../plugins/github/utils/github-app";

export async function importIssues(projectId: string) {
  const githubApp = getGithubApp();

  if (!githubApp) {
    return { error: "GitHub app not configured" };
  }

  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
  });

  if (!integration) {
    return { error: "GitHub integration not found" };
  }

  const config = JSON.parse(integration.config) as {
    repositoryOwner: string;
    repositoryName: string;
    installationId: number | null;
  };

  if (!config.installationId) {
    return { error: "GitHub installation not found" };
  }

  // Get project with workspace ID for label association
  const project = await db.query.projectTable.findFirst({
    where: eq(db._.fullSchema.projectTable.id, projectId),
    with: {
      workspace: true,
    },
  });

  if (!project) {
    return { error: "Project not found" };
  }

  const installationOctokit = await githubApp.getInstallationOctokit(
    config.installationId,
  );

  let imported = 0;
  let skipped = 0;
  let page = 1;
  const perPage = 100;

  // Paginate through all open issues
  while (true) {
    const { data: issues } = await installationOctokit.rest.issues.listForRepo({
      owner: config.repositoryOwner,
      repo: config.repositoryName,
      state: "open", // Only import open issues
      per_page: perPage,
      page,
    });

    // No more issues, break
    if (!issues || issues.length === 0) {
      break;
    }

    for (const issue of issues) {
      // Skip pull requests
      if (issue.pull_request) {
        skipped++;
        continue;
      }

      // Check if issue already imported using proper duplicate detection
      const existingLink = await findExternalLink(
        integration.id,
        "issue",
        issue.number.toString(),
      );

      if (existingLink) {
        skipped++;
        continue;
      }

      // Extract priority and status from labels
      const priority = extractIssuePriority(issue.labels);
      const status = extractIssueStatus(issue.labels);

      // Create task with imported data
      const [newTask] = await db
        .insert(taskTable)
        .values({
          title: issue.title,
          description: issue.body || null,
          projectId,
          number: issue.number,
          status: status || "to-do", // Use extracted status or default
          priority: priority || "no-priority", // Use extracted priority or default
          position: 0,
          createdAt: new Date(issue.created_at),
        })
        .returning();

      if (!newTask) {
        continue;
      }

      // Create external link
      await createExternalLink({
        taskId: newTask.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: issue.number.toString(),
        url: issue.html_url,
        title: issue.title,
        metadata: {
          state: issue.state,
          importedFrom: "github",
          author: issue.user?.login,
        },
      });

      // Import labels
      if (issue.labels && issue.labels.length > 0) {
        for (const label of issue.labels) {
          const labelName = typeof label === "string" ? label : label?.name;
          const labelColor = typeof label === "string" ? null : label?.color;

          if (!labelName) {
            continue;
          }

          // Skip system labels (already applied to task fields)
          const isSystemLabel =
            labelName.startsWith("priority:") ||
            labelName.startsWith("status:");

          if (isSystemLabel) {
            continue;
          }

          // Create label with both workspace and task association
          const color = labelColor ? `#${labelColor}` : "#6B7280";
          await db.insert(labelTable).values({
            name: labelName,
            color,
            taskId: newTask.id,
            workspaceId: project.workspaceId,
          });
        }
      }

      // Import comments
      const { data: comments } =
        await installationOctokit.rest.issues.listComments({
          owner: config.repositoryOwner,
          repo: config.repositoryName,
          issue_number: issue.number,
          per_page: 100, // GitHub max
        });

      if (comments && comments.length > 0) {
        for (const comment of comments) {
          // Skip bot comments
          if (comment.user?.login.endsWith("[bot]")) {
            continue;
          }

          // Create activity entry for comment
          await db.insert(activityTable).values({
            id: createId(),
            taskId: newTask.id,
            type: "comment",
            content: comment.body,
            externalUserName: comment.user?.login || "Unknown",
            externalUserAvatar: comment.user?.avatar_url,
            externalSource: "github",
            externalUrl: comment.html_url,
            createdAt: new Date(comment.created_at),
          });
        }
      }

      imported++;
    }

    // Move to next page
    page++;
  }

  return { imported, skipped };
}
