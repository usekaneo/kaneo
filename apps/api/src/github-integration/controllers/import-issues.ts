import { and, eq, notLike } from "drizzle-orm";
import db from "../../database";
import { integrationTable, taskTable } from "../../database/schema";
import { createExternalLink } from "../../plugins/github/services/link-manager";
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

  const installationOctokit = await githubApp.getInstallationOctokit(
    config.installationId,
  );

  const { data: issues } = await installationOctokit.rest.issues.listForRepo({
    owner: config.repositoryOwner,
    repo: config.repositoryName,
    state: "all",
    per_page: 100,
  });

  let imported = 0;
  let skipped = 0;

  for (const issue of issues ?? []) {
    if (issue.pull_request) {
      skipped++;
      continue;
    }

    const existingTask = await db.query.taskTable.findFirst({
      where: and(
        eq(taskTable.projectId, projectId),
        notLike(taskTable.title, "[Kaneo]%"),
      ),
    });

    const hasExistingLink = existingTask
      ? await db.query.externalLinkTable.findFirst({
          where: and(
            eq(db._.fullSchema.externalLinkTable.taskId, existingTask.id),
            eq(
              db._.fullSchema.externalLinkTable.externalId,
              issue.number.toString(),
            ),
          ),
        })
      : null;

    if (hasExistingLink) {
      skipped++;
      continue;
    }

    const [newTask] = await db
      .insert(taskTable)
      .values({
        title: issue.title,
        description: issue.body || null,
        projectId,
        number: issue.number,
        status: issue.state === "closed" ? "done" : "to-do",
        priority: "medium",
        position: 0,
        createdAt: new Date(issue.created_at),
      })
      .returning();

    if (newTask) {
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
      imported++;
    }
  }

  return { imported, skipped };
}
