import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { normalizeGiteaBaseUrl } from "../../plugins/gitea/config";
import {
  createGiteaClient,
  verifyGiteaToken,
} from "../../plugins/gitea/utils/gitea-api";
import { giteaRepositoryKey } from "./create-gitea-integration";

type LinkedTo = {
  integrationId: string;
  projectId: string;
  projectName: string | null;
};

type RepoRow = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string };
  html_url: string;
  linkedTo: LinkedTo | null;
};

// RFC 0001 WP3: annotate each listed repository with its linked state,
// resolved by a server-side Map keyed by repository_key rather than repeated
// in-memory filtering. The annotation is scoped to the authorized project and
// to active bindings: cross-project bindings may share the repository
// (allowed per decision D1), but their project names, ids, and integration
// ids stay private to the projects that own them, and deactivated bindings do
// not hold the repository either.
async function listGiteaRepositories({
  baseUrl,
  accessToken,
  projectId,
}: {
  baseUrl: string;
  accessToken: string;
  projectId: string;
}): Promise<{ repositories: RepoRow[] }> {
  const normalized = normalizeGiteaBaseUrl(baseUrl);

  try {
    await verifyGiteaToken(normalized, accessToken);
  } catch {
    throw new HTTPException(400, {
      message: "Invalid Gitea token or could not reach instance.",
    });
  }

  const client = createGiteaClient({
    baseUrl: normalized,
    accessToken,
  });

  const all: RepoRow[] = [];
  let page = 1;

  while (true) {
    const batch = await client.listUserRepos(page, 50);
    if (!batch.length) break;

    for (const repo of batch) {
      const ownerLogin = repo.owner?.login ?? repo.owner?.username ?? "";
      all.push({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        owner: { login: ownerLogin },
        html_url: repo.html_url,
        linkedTo: null,
      });
    }

    if (batch.length < 50) break;
    page += 1;
    if (page > 50) break;
  }

  // Linked-state annotation: one indexed query over the candidate keys,
  // cross-referenced through a Map (RFC section 7, js-set-map-lookups).
  if (all.length > 0) {
    const keyByRepo = new Map<number, string>();
    for (const repo of all) {
      keyByRepo.set(
        repo.id,
        giteaRepositoryKey(normalized, repo.owner.login, repo.name),
      );
    }
    const keys = [...new Set(keyByRepo.values())];

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
          eq(integrationTable.type, "gitea"),
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
    const bindingByKey = new Map<string | null, (typeof bindings)[number]>();
    for (const binding of bindings) {
      if (binding.projectId === projectId && binding.isActive === true) {
        bindingByKey.set(binding.repositoryKey, binding);
      }
    }

    for (const repo of all) {
      const key = keyByRepo.get(repo.id);
      const binding = key ? bindingByKey.get(key) : undefined;
      if (binding) {
        repo.linkedTo = {
          integrationId: binding.integrationId,
          projectId: binding.projectId,
          projectName: binding.projectName,
        };
      }
    }
  }

  return { repositories: all };
}

export default listGiteaRepositories;
