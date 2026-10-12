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
// in-memory filtering. Same-project links block selection in the picker;
// cross-project links (allowed per decision D1) are informational only.
async function listGiteaRepositories({
  baseUrl,
  accessToken,
  projectId,
}: {
  baseUrl: string;
  accessToken: string;
  projectId?: string;
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
      })
      .from(integrationTable)
      .innerJoin(projectTable, eq(integrationTable.projectId, projectTable.id))
      .where(
        and(
          eq(integrationTable.type, "gitea"),
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
