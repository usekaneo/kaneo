type Identified = { id: number };

export function collectRepositories<Repository extends Identified>(
  pages: { repositories: Repository[] }[] | undefined,
) {
  const seen = new Set<number>();
  const repositories: Repository[] = [];
  for (const page of pages ?? []) {
    for (const repository of page.repositories) {
      if (seen.has(repository.id)) continue;
      seen.add(repository.id);
      repositories.push(repository);
    }
  }
  return repositories;
}
