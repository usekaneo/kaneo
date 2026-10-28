import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import db, { schema } from "../../database";
import { getGithubAccount } from "../../github-integration/controllers/verify-repository-owner";
import { getLinkedGithubPermission } from "../../github-integration/github-collaborator-permission";
import {
  githubConfigSchema,
  hasVerifiedGitHubBinding,
} from "../../plugins/github/config";
import { activeIntegrationCondition } from "../../plugins/active-integration-condition";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { hasUserWorkspacePermission } from "../../utils/require-workspace-permission";
import { codeJobsEnabled } from "./config";
import { getAgentRepositoryAccess } from "./agent-github-app";
import type { AgentSubject } from "../types";

export async function listCodeRepositories(subject: AgentSubject) {
  if (
    !codeJobsEnabled() ||
    !(await hasUserWorkspacePermission(subject.userId, subject.workspaceId, {
      agent: ["run_code"],
    }))
  )
    return [];
  const integrations = await db
    .select({ integration: schema.integrationTable })
    .from(schema.integrationTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.integrationTable.projectId, schema.projectTable.id),
    )
    .where(
      and(
        eq(schema.projectTable.workspaceId, subject.workspaceId),
        projectAccessCondition(subject.userId, schema.projectTable.id),
        ...(subject.projectId
          ? [eq(schema.projectTable.id, subject.projectId)]
          : []),
        eq(schema.integrationTable.type, "github"),
        activeIntegrationCondition(),
      ),
    )
    .limit(100);
  const result = [];
  for (const { integration } of integrations) {
    let data: unknown;
    try {
      data = JSON.parse(integration.config);
    } catch {
      continue;
    }
    const parsed = v.safeParse(githubConfigSchema, data);
    if (
      !parsed.success ||
      !hasVerifiedGitHubBinding(parsed.output) ||
      !parsed.output.codingAgent?.enabled
    )
      continue;
    const config = parsed.output;
    let state: "ready" | "unavailable" = "unavailable";
    let defaultBranch: string | null = null;
    try {
      const account = await getGithubAccount(subject.userId);
      const { octokit, repository } = await getAgentRepositoryAccess({
        ...config,
        repositoryId: config.repositoryId!,
      });
      const permission = await getLinkedGithubPermission(
        octokit,
        { owner: config.repositoryOwner, name: config.repositoryName },
        Number(account.accountId),
      );
      if (["write", "maintain", "admin"].includes(permission)) {
        defaultBranch = repository.default_branch;
        const { data: workflow } = await octokit.rest.actions.getWorkflow({
          owner: config.repositoryOwner,
          repo: config.repositoryName,
          workflow_id: "kaneo-agent.yml",
        });
        if (workflow.state === "active") state = "ready";
      }
    } catch {
      /* Availability never discloses GitHub errors or credentials. */
    }
    result.push({
      integrationId: integration.id,
      projectId: integration.projectId,
      host: "github" as const,
      fullName: `${config.repositoryOwner}/${config.repositoryName}`,
      defaultBranch,
      backend: "repo-ci" as const,
      state,
    });
  }
  return result;
}
