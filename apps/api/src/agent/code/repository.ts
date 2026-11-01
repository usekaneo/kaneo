import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db, { schema } from "../../database";
import { requireWorkspaceEntitlement } from "../../billing/controllers/require-entitlement";
import { getGithubAccount } from "../../github-integration/controllers/verify-repository-owner";
import { getLinkedGithubPermission } from "../../github-integration/github-collaborator-permission";
import { activeIntegrationCondition } from "../../plugins/active-integration-condition";
import {
  githubConfigSchema,
  hasVerifiedGitHubBinding,
} from "../../plugins/github/config";
import { assertAgentAccess, type AgentDatabase } from "../access";
import { getScopedTask } from "../controllers/get-scoped-task";
import type { AgentSubject } from "../types";
import { getAgentRepositoryAccess } from "./agent-github-app";
import { codeJobsEnabled } from "./config";

export async function codeRepository(
  subject: AgentSubject,
  taskId: string,
  integrationId: string,
  database: AgentDatabase = db,
  allowDisabled = false,
) {
  await assertAgentAccess(
    subject,
    { agent: ["run_code"], task: ["read"], project: ["read"] },
    database,
  );
  await requireWorkspaceEntitlement(subject.workspaceId);
  if (!allowDisabled && !(await codeJobsEnabled()))
    throw new HTTPException(503, { message: "Coding jobs are not configured" });
  const task = await getScopedTask(subject, taskId, database);
  const integration = await database.query.integrationTable.findFirst({
    where: and(
      eq(schema.integrationTable.id, integrationId),
      eq(schema.integrationTable.projectId, task.projectId),
      eq(schema.integrationTable.type, "github"),
      activeIntegrationCondition(),
    ),
  });
  if (!integration)
    throw new HTTPException(404, { message: "Repository unavailable" });
  const parsed = v.safeParse(
    githubConfigSchema,
    JSON.parse(integration.config),
  );
  if (
    !parsed.success ||
    !hasVerifiedGitHubBinding(parsed.output) ||
    !parsed.output.codingAgent?.enabled
  )
    throw new HTTPException(404, { message: "Repository unavailable" });
  const config = parsed.output;
  const account = await getGithubAccount(subject.userId);
  try {
    const access = await getAgentRepositoryAccess({
      ...config,
      repositoryId: config.repositoryId!,
    });
    const permission = await getLinkedGithubPermission(
      access.octokit,
      { owner: config.repositoryOwner, name: config.repositoryName },
      Number(account.accountId),
    );
    if (!["write", "maintain", "admin"].includes(permission))
      throw new Error("write_required");
    return { ...access, task, integration, config };
  } catch {
    throw new HTTPException(403, {
      message:
        "Repository write access and the installed Kaneo Agent App are required",
    });
  }
}
