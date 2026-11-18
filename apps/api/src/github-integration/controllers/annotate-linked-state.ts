import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  githubRepositoryKey,
  legacyGithubRepositoryKey,
} from "./create-github-integration";

// RFC 0001 WP2: annotate each listed repository with its linked state using
// a single query on repository_key (numeric keys for verified bindings plus
// the legacy owner/name form). The annotation is scoped to the authorized
// project (the route's projectId param) and to active bindings, so a
// repository list can only ever disclose the caller's own project, never
// another project's name, id, or integration ids.
type AnnotatableRepository = {
  id: number;
  name: string;
  owner: { login: string };
};
export async function annotateLinkedState<T extends AnnotatableRepository>(
  repositories: T[],
  projectId: string,
) {
  if (repositories.length === 0) return [];
  const keys = new Set<string>();
  for (const repository of repositories) {
    keys.add(githubRepositoryKey(repository.id));
    keys.add(
      legacyGithubRepositoryKey(repository.owner.login, repository.name),
    );
  }
  const links = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.type, "github"),
      // Security: same-project scope only. Cross-project bindings may share
      // the repository (allowed per decision D1), but their details stay
      // private to the projects that own them.
      eq(integrationTable.projectId, projectId),
      // Deactivated bindings do not hold the repository, so they do not
      // annotate as linked.
      eq(integrationTable.isActive, true),
      inArray(integrationTable.repositoryKey, [...keys]),
    ),
    columns: { id: true, projectId: true, repositoryKey: true, isActive: true },
    with: { project: { columns: { name: true } } },
  });
  // Defense in depth: the query already constrains project and is_active;
  // this check runs again on the returned rows so a query regression can
  // never surface another project's binding details.
  const authorized = links.filter(
    (link) => link.projectId === projectId && link.isActive === true,
  );
  const linksByKey = new Map(
    authorized.map((link) => [
      link.repositoryKey,
      {
        integrationId: link.id,
        projectId: link.projectId,
        projectName: link.project?.name ?? null,
      },
    ]),
  );
  return repositories.map((repository) => ({
    ...repository,
    linkedTo:
      linksByKey.get(githubRepositoryKey(repository.id)) ??
      linksByKey.get(
        legacyGithubRepositoryKey(repository.owner.login, repository.name),
      ) ??
      null,
  }));
}
