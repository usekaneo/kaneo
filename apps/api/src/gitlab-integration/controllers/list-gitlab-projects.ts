import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { GitlabTokenType } from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";
import { gitlabRepositoryKey } from "./create-gitlab-integration";
import { parseGitlabBaseUrl, parseGitlabProjectPath } from "../utils/normalize-input";

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
// in-memory filtering. Same-project links block selection in the picker;
// cross-project links (allowed per decision D1) are informational only.
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
      })
      .from(integrationTable)
      .innerJoin(projectTable, eq(integrationTable.projectId, projectTable.id))
      .where(
        and(
          eq(integrationTable.type, "gitlab"),
          inArray(integrationTable.repositoryKey, keys),
        ),
      );

    const bindingByKey = new Map<string, (typeof bindings)[number]>();
    for (const binding of bindings) {
      // Same-project annotation wins; cross-project is informational only.
      if (!bindingByKey.has(binding.repositoryKey)) {
        bindingByKey.set(binding.repositoryKey, binding);
      } else if (
        projectId !== undefined &&
        binding.projectId === projectId
      ) {
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
