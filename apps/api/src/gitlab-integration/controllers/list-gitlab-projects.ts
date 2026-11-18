import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { GitlabTokenType } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";
import { gitlabRepositoryKey } from "./create-gitlab-integration";
import {
  parseGitlabBaseUrl,
  parseGitlabProjectPath,
} from "../utils/normalize-input";

type LinkedTo = {
  integrationId: string;
  projectId: string;
  projectName: string | null;
};

type ProjectRow = {
  id: number;
  name: string;
  path_with_namespace: string;
  name_with_namespace: string;
  visibility: string;
  web_url: string;
  linkedTo: LinkedTo | null;
};

const PER_PAGE = 50;
const MAX_PAGES = 50;

// RFC 0001 WP4: annotate each listed project with its linked state, resolved
// by a server-side Map keyed by repository_key rather than repeated
// in-memory filtering. The annotation is scoped to the authorized project and
// to active bindings: cross-project bindings may share the repository
// (allowed per decision D1), but their project names, ids, and integration
// ids stay private to the projects that own them, and deactivated bindings do
// not hold the repository either.
async function listGitlabProjects({
  baseUrl,
  accessToken,
  tokenType,
  projectId,
}: {
  baseUrl: string;
  accessToken: string;
  tokenType: GitlabTokenType;
  projectId?: string;
}): Promise<{ projects: ProjectRow[] }> {
  const normalized = parseGitlabBaseUrl(baseUrl);

  try {
    await verifyGitlabToken(normalized, accessToken, tokenType);
  } catch {
    throw new ApiError(401, {
      message: "Invalid GitLab token or could not reach instance.",
      code: "INTEGRATION_AUTH_FAILED",
    });
  }

  const client = createGitlabClient({
    baseUrl: normalized,
    accessToken,
    tokenType,
  });

  const projects: ProjectRow[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await client.listMemberProjects(page, PER_PAGE);
    if (batch.length === 0) break;

    for (const project of batch) {
      projects.push({
        id: project.id,
        name: project.name,
        path_with_namespace: project.path_with_namespace,
        name_with_namespace: project.name_with_namespace,
        visibility: project.visibility,
        web_url: project.web_url,
        linkedTo: null,
      });
    }

    if (batch.length < PER_PAGE) break;
  }

  // Linked-state annotation: one indexed query over the candidate keys,
  // cross-referenced through a Map (RFC section 7, js-set-map-lookups).
  if (projects.length > 0) {
    const keyByProject = new Map<number, string>();
    for (const project of projects) {
      keyByProject.set(
        project.id,
        gitlabRepositoryKey(
          normalized,
          parseGitlabProjectPath(project.path_with_namespace),
        ),
      );
    }
    const keys = [...new Set(keyByProject.values())];

    const bindings = await db
      .select({
        integrationId: integrationTable.id,
        repositoryKey: integrationTable.repositoryKey,
        projectId: integrationTable.projectId,
        projectName: projectTable.name,
        isActive: integrationTable.isActive,
      })
      .from(integrationTable)
      .innerJoin(projectTable, eq(integrationTable.projectId, projectTable.id))
      .where(
        and(
          eq(integrationTable.type, "gitlab"),
          // Security: same-project scope only, so the list can never disclose
          // another project's name, id, or integration ids.
          eq(integrationTable.projectId, projectId),
          // Deactivated bindings do not hold the repository.
          eq(integrationTable.isActive, true),
          inArray(integrationTable.repositoryKey, keys),
        ),
      );

    // Defense in depth: the query already constrains project and is_active;
    // this check runs again on the returned rows so a query regression can
    // never surface another project's binding details.
    const bindingByKey = new Map<string, (typeof bindings)[number]>();
    for (const binding of bindings) {
      if (binding.projectId === projectId && binding.isActive === true) {
        bindingByKey.set(binding.repositoryKey, binding);
      }
    }

    for (const project of projects) {
      const key = keyByProject.get(project.id);
      const binding = key ? bindingByKey.get(key) : undefined;
      if (binding) {
        project.linkedTo = {
          integrationId: binding.integrationId,
          projectId: binding.projectId,
          projectName: binding.projectName,
        };
      }
    }
  }

  return { projects };
}

export default listGitlabProjects;
