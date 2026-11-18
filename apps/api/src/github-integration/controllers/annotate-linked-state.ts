import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { githubRepositoryKey } from "./create-github-integration";

/** Legacy pre-re-keying key form: `github:<owner>/<name>` lowercased. */
function legacyGithubRepositoryKey(
  ownerLogin: string,
  repositoryName: string,
): string {
  return `github:${ownerLogin}/${repositoryName}`.toLowerCase();
}

// RFC 0001 WP2: annotate each listed repository with its linked state using
// a single query on repository_key (numeric keys for verified bindings plus
// the legacy owner/name form). Per decision D1 the annotation is
// informational for cross-project links; only the picker UI blocks
// same-project duplicates.
type AnnotatableRepository = {
  id: number;
  name: string;
  owner: { login: string };
};
export async function annotateLinkedState<T extends AnnotatableRepository>(
  repositories: T[],
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
      inArray(integrationTable.repositoryKey, [...keys]),
    ),
    columns: { id: true, projectId: true, repositoryKey: true },
    with: { project: { columns: { name: true } } },
  });
  const linksByKey = new Map(
    links.map((link) => [
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
