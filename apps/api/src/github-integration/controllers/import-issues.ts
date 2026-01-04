import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  externalLinkTable,
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

  // Paginate through all issues (open and closed)
  while (true) {
    const { data: issues } = await installationOctokit.rest.issues.listForRepo({
      owner: config.repositoryOwner,
      repo: config.repositoryName,
      state: "all", // Import both open and closed issues
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

      const existingLink = await findExternalLink(
        integration.id,
        "issue",
        issue.number.toString(),
      );

      if (existingLink) {
        const taskExists = await db.query.taskTable.findFirst({
          where: eq(taskTable.id, existingLink.taskId),
        });

        if (taskExists) {
          skipped++;
          continue;
        }

        await db
          .delete(externalLinkTable)
          .where(eq(externalLinkTable.id, existingLink.id));
      }

      const priority = extractIssuePriority(issue.labels);
      const statusFromLabels = extractIssueStatus(issue.labels);

      const taskStatus =
        issue.state === "closed" ? "done" : statusFromLabels || "to-do";

      const [newTask] = await db
        .insert(taskTable)
        .values({
          title: issue.title,
          description: issue.body || null,
          projectId,
          number: issue.number,
          status: taskStatus,
          priority: priority || "no-priority",
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
          if (comment.user?.login.endsWith("[bot]")) {
            continue;
          }

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

      try {
        const { data: timeline } =
          await installationOctokit.rest.issues.listEventsForTimeline({
            owner: config.repositoryOwner,
            repo: config.repositoryName,
            issue_number: issue.number,
            per_page: 100,
          });

        for (const event of timeline) {
          if (
            event.event === "cross-referenced" &&
            "source" in event &&
            event.source?.issue?.pull_request
          ) {
            const prIssue = event.source.issue;
            const prNumber = prIssue.number;

            const existingPRLink = await findExternalLink(
              integration.id,
              "pull_request",
              prNumber.toString(),
            );

            if (!existingPRLink) {
              await createExternalLink({
                taskId: newTask.id,
                integrationId: integration.id,
                resourceType: "pull_request",
                externalId: prNumber.toString(),
                url: prIssue.html_url,
                title: prIssue.title,
                metadata: {
                  state: prIssue.state,
                  merged: prIssue.pull_request?.merged_at ? true : false,
                  importedFrom: "github-import",
                  author: prIssue.user?.login,
                },
              });
            }
          }
        }
      } catch {
        // Timeline API requires specific permissions, silently skip if unavailable
      }

      imported++;
    }

    page++;
  }

  return { imported, skipped };
}
