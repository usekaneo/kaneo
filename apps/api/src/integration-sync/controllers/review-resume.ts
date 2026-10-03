import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import { isTaskInFinalState } from "../../plugins/github/services/task-service";
import { taskMatchesRule } from "../../plugins/sync/eligibility";
import { providerIssue } from "../../plugins/sync/provider-issue";
import { isSyncPaused, readSyncRules } from "../../plugins/sync/rules";
import { getSyncIntegration } from "./get-integration";
import type { IntegrationDatabase } from "../../plugins/github/services/integration-task-scope";

export async function reviewSyncResume(
  projectId: string,
  provider: string,
  linkId: string,
  database: IntegrationDatabase = db,
) {
  const integration = await getSyncIntegration(projectId, provider, database);
  const link = await database.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.id, linkId),
      eq(externalLinkTable.integrationId, integration.id),
      eq(externalLinkTable.resourceType, "issue"),
    ),
  });
  const task =
    link &&
    (await database.query.taskTable.findFirst({
      where: and(
        eq(taskTable.id, link.taskId),
        eq(taskTable.projectId, projectId),
      ),
    }));
  if (!link || !task)
    throw new HTTPException(404, { message: "Linked task not found" });
  if (
    !integration.isActive ||
    !isSyncPaused(link.metadata) ||
    !(await taskMatchesRule(
      task.id,
      projectId,
      readSyncRules(integration.config)!.outgoing,
      database,
    ))
  )
    throw new HTTPException(409, {
      message:
        "The task must match the current rule and be paused before resuming",
    });
  try {
    const access = await providerIssue(integration, link);
    const remoteIssue = await access.read();
    const local = {
      title: task.title,
      description: task.description ?? "",
      state: (await isTaskInFinalState(task, database))
        ? ("closed" as const)
        : ("open" as const),
    };
    const remote = {
      title: remoteIssue.title,
      description: remoteIssue.description,
      state: remoteIssue.state,
    };
    const token = createHash("sha256")
      .update(
        JSON.stringify({
          binding: [integration.id, integration.config],
          task,
          link,
          local,
          remoteIssue,
        }),
      )
      .digest("hex");
    return {
      integration,
      link,
      task,
      access,
      local,
      remote,
      remoteIssueUpdatedAt: remoteIssue.updatedAt,
      token,
    };
  } catch {
    throw new HTTPException(502, {
      message: "External issue could not be read; sync remains paused",
    });
  }
}
