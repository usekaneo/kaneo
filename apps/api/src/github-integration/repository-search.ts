export type RepositoryPage = {
  installationPage: number;
  repositoryPage: number;
};

type SearchableRepository = {
  id: number;
  full_name: string;
  description: string | null;
};

export type RepositorySource<
  Candidate extends SearchableRepository,
  Authorized extends { id: number },
  Installation,
> = {
  installation: Installation;
  listRepositories: (repositoryPage: number) => Promise<Candidate[]>;
  authorize: (candidates: Candidate[]) => Promise<Authorized[]>;
};

export type RepositorySearchGroup<Authorized, Installation> = {
  installation: Installation;
  repositories: Authorized[];
};

export function matchesRepositorySearch(
  repository: Pick<SearchableRepository, "full_name" | "description">,
  search: string,
) {
  const needle = search.toLowerCase();
  return (
    repository.full_name.toLowerCase().includes(needle) ||
    (repository.description?.toLowerCase().includes(needle) ?? false)
  );
}

export function nextRepositoryPage(
  page: RepositoryPage,
  fetched: number,
  perPage: number,
): RepositoryPage {
  return fetched === perPage
    ? {
        installationPage: page.installationPage,
        repositoryPage: page.repositoryPage + 1,
      }
    : { installationPage: page.installationPage + 1, repositoryPage: 1 };
}

export async function searchRepositoryPages<
  Candidate extends SearchableRepository,
  Authorized extends { id: number },
  Installation,
>({
  start,
  search,
  perPage,
  maxListCalls,
  matchTarget,
  openInstallation,
}: {
  start: RepositoryPage;
  search: string;
  perPage: number;
  maxListCalls: number;
  matchTarget: number;
  openInstallation: (
    installationPage: number,
  ) => Promise<RepositorySource<Candidate, Authorized, Installation> | null>;
}): Promise<{
  groups: RepositorySearchGroup<Authorized, Installation>[];
  nextPage: RepositoryPage | null;
}> {
  const groups: RepositorySearchGroup<Authorized, Installation>[] = [];
  const seen = new Set<number>();
  let page = start;
  let listCalls = 0;
  let matched = 0;

  for (;;) {
    const source = await openInstallation(page.installationPage);
    if (!source) return { groups, nextPage: null };

    const repositories: Authorized[] = [];
    let installationDone = false;
    let budgetSpent = false;

    while (!installationDone && !budgetSpent) {
      const fetched = await source.listRepositories(page.repositoryPage);
      listCalls += 1;
      const candidates = fetched.filter(
        (repository) =>
          !seen.has(repository.id) &&
          matchesRepositorySearch(repository, search),
      );
      const authorized = candidates.length
        ? await source.authorize(candidates)
        : [];
      for (const repository of authorized) {
        seen.add(repository.id);
        repositories.push(repository);
      }
      matched += authorized.length;
      installationDone = fetched.length < perPage;
      page = nextRepositoryPage(page, fetched.length, perPage);
      budgetSpent = listCalls >= maxListCalls || matched >= matchTarget;
    }

    if (repositories.length)
      groups.push({ installation: source.installation, repositories });
    if (budgetSpent) return { groups, nextPage: page };
  }
}
