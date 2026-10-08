import { acceptsIssue } from "../../sync/rules";
import { importIssueLabels } from "../../sync/issue-labels";
import { canSyncTask } from "../../sync/eligibility";
import { createIssueWrite } from "../../sync/dispatch-issue-write";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import {
  columnTable,
  integrationTable,
  projectTable,
  taskTable,
} from "../../../database/schema";
import { publishEvent } from "../../../events";
import { claimTaskNumber } from "../../../task/controllers/claim-task-numbers";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import type { GiteaConfig } from "../config";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { markKaneoComment } from "../utils/comment-origin";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea } from "../utils/labels";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type IssueOpenedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    state?: string;
    body: string | null;
    html_url: string;
    labels?: Array<string | { name?: string; color?: string }>;
    user: { login?: string; username?: string } | null;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaIssueOpened(
  payload: IssueOpenedPayload,
  integrationId?: string,
) {
  const { issue, repository } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) {
    return;
  }

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
    integrationId,
  );

  if (integrations.length === 0) {
    return;
  }

  for (const integration of integrations) {
    if (!acceptsIssue(integration.config, issue.labels)) continue;
    let config: GiteaConfig;
    try {
      config = JSON.parse(integration.config) as GiteaConfig;
    } catch (error) {
      console.error("Invalid Gitea config for integration", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectId = integration.projectId;
    const closed = issue.state === "closed";

    const priority = extractIssuePriority(issue.labels);
    const status = extractIssueStatus(issue.labels);

    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(integrationTable)
        .where(eq(integrationTable.id, integration.id))
        .for("update");
      if (
        !current?.isActive ||
        current.config !== integration.config ||
        !acceptsIssue(current.config, issue.labels)
      )
        return null;
      if (
        await findExternalLink(
          integration.id,
          "issue",
          String(issue.number),
          tx,
        )
      )
        return null;
      const resolvedStatus = await resolveTargetStatus(
        projectId,
        closed ? "issue_closed" : "issue_opened",
        closed ? "done" : status || "to-do",
        tx,
      );
      let targetColumn = await tx.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.slug, resolvedStatus),
        ),
      });
      if (closed && !targetColumn?.isFinal)
        targetColumn = await tx.query.columnTable.findFirst({
          where: and(
            eq(columnTable.projectId, projectId),
            eq(columnTable.isFinal, true),
          ),
          orderBy: (column, { asc }) => [asc(column.position)],
        });
      const nextTaskNumber = await claimTaskNumber(projectId, tx);
      const [task] = await tx
        .insert(taskTable)
        .values({
          projectId,
          userId: null,
          title: issue.title,
          description: formatTaskDescriptionFromIssue(issue.body),
          status: closed ? (targetColumn?.slug ?? "done") : resolvedStatus,
          columnId: targetColumn?.id ?? null,
          priority: priority ?? "low",
          number: nextTaskNumber,
        })
        .returning();
      if (!task) throw new Error("Failed to create task from gitea issue");
      const linkMetadata = {
        state: closed ? "closed" : "open",
        createdFrom: "gitea",
        author: issue.user?.login ?? issue.user?.username,
      };
      const link = await createExternalLink(
        {
          taskId: task.id,
          integrationId: integration.id,
          resourceType: "issue",
          externalId: String(issue.number),
          url: issue.html_url,
          title: issue.title,
          metadata: linkMetadata,
        },
        tx,
      );
      await importIssueLabels(
        task.id,
        integration.project.workspaceId,
        issue.labels,
        tx,
      );
      const eligible = await canSyncTask(
        task.id,
        integration.id,
        tx,
        integration.config,
      );
      return { task, link, linkMetadata, eligible };
    });
    if (!result) continue;
    const { task: createdTask, link, eligible } = result;

    await publishEvent("task.created", {
      ...createdTask,
      taskId: createdTask.id,
      userId: createdTask.userId ?? "",
      type: "task",
      content: null,
      source: "gitea",
      externalId: issue.number.toString(),
      actor: issue.user?.login ?? issue.user?.username ?? "gitea-webhook",
    });
    if (!eligible) continue;
    const write = createIssueWrite(
      { id: link.id, taskId: createdTask.id, integrationId: integration.id },
      integration.config,
    );

    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });

    if (!project) {
      continue;
    }

    const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
    const taskUrl = `${clientUrl}/dashboard/workspace/${project.workspaceId}/project/${projectId}/task/${createdTask.id}`;
    const taskIdentifier = `${project.slug.toUpperCase()}-${createdTask.number}`;

    try {
      const client = createGiteaClient(config);

      const existingLabels =
        issue.labels
          ?.map((label) => (typeof label === "string" ? label : label.name))
          .filter(Boolean) || [];

      const labelsToAdd: string[] = [];

      if (priority && !existingLabels.includes(`priority:${priority}`)) {
        labelsToAdd.push(`priority:${priority}`);
      }

      if (status && !existingLabels.includes(`status:${status}`)) {
        labelsToAdd.push(`status:${status}`);
      }

      if (labelsToAdd.length > 0) {
        await addLabelsToIssueGitea(
          config,
          issue.number,
          labelsToAdd,
          true,
          write,
        );
      }

      if (config.commentTaskLinkOnGiteaIssue !== false) {
        await write(() =>
          client.createIssueComment(
            config.repositoryOwner,
            config.repositoryName,
            issue.number,
            markKaneoComment(`[${taskIdentifier}](${taskUrl})`),
          ),
        );
      }
    } catch {
      console.error("Gitea imported issue linking write failed", {
        projectId,
        taskId: createdTask.id,
        integrationId: integration.id,
        linkId: link.id,
      });
    }
  }
}
