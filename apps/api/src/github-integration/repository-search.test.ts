import { describe, expect, it, vi } from "vite-plus/test";
import {
  matchesRepositorySearch,
  nextRepositoryPage,
  type RepositorySource,
  searchRepositoryPages,
} from "./repository-search";

type Repo = { id: number; full_name: string; description: string | null };

function repo(id: number, name: string, description: string | null = null) {
  return { id, full_name: `acme/${name}`, description };
}

function filler(start: number, count: number) {
  return Array.from({ length: count }, (_, index) =>
    repo(start + index, `filler-${start + index}`),
  );
}

function installations(pages: Repo[][][]) {
  const authorize = vi.fn(async (candidates: Repo[]) => candidates);
  const listRepositories = vi.fn();
  const openInstallation = vi.fn(
    async (
      installationPage: number,
    ): Promise<RepositorySource<Repo, Repo, number> | null> => {
      const installation = pages[installationPage - 1];
      if (!installation) return null;
      return {
        installation: installationPage,
        listRepositories: async (repositoryPage) => {
          listRepositories(installationPage, repositoryPage);
          return installation[repositoryPage - 1] ?? [];
        },
        authorize,
      };
    },
  );
  return { authorize, listRepositories, openInstallation };
}

describe("matchesRepositorySearch", () => {
  it("matches the full name or description without regard to case", () => {
    expect(matchesRepositorySearch(repo(1, "Website"), "WEB")).toBe(true);
    expect(
      matchesRepositorySearch(repo(2, "api", "Marketing site"), "market"),
    ).toBe(true);
    expect(matchesRepositorySearch(repo(3, "api", null), "web")).toBe(false);
  });
});

describe("nextRepositoryPage", () => {
  it("stays on the installation while pages are full", () => {
    expect(
      nextRepositoryPage({ installationPage: 2, repositoryPage: 3 }, 100, 100),
    ).toEqual({ installationPage: 2, repositoryPage: 4 });
    expect(
      nextRepositoryPage({ installationPage: 2, repositoryPage: 3 }, 40, 100),
    ).toEqual({ installationPage: 3, repositoryPage: 1 });
  });
});

describe("searchRepositoryPages", () => {
  it("filters before authorizing and scans later pages and installations", async () => {
    const source = installations([
      [
        [...filler(1, 98), repo(200, "web-app"), repo(201, "docs", "Website")],
        [repo(202, "api")],
      ],
      [[repo(300, "web-experiments"), repo(301, "infra")]],
    ]);

    const result = await searchRepositoryPages({
      start: { installationPage: 1, repositoryPage: 1 },
      search: "web",
      perPage: 100,
      maxListCalls: 10,
      matchTarget: 20,
      openInstallation: source.openInstallation,
    });

    expect(source.authorize.mock.calls).toEqual([
      [[repo(200, "web-app"), repo(201, "docs", "Website")]],
      [[repo(300, "web-experiments")]],
    ]);
    expect(result.groups).toEqual([
      {
        installation: 1,
        repositories: [repo(200, "web-app"), repo(201, "docs", "Website")],
      },
      { installation: 2, repositories: [repo(300, "web-experiments")] },
    ]);
    expect(result.nextPage).toBeNull();
  });

  it("drops candidates the caller cannot administer", async () => {
    const source = installations([[[repo(1, "web"), repo(2, "web-private")]]]);
    source.authorize.mockImplementation(async (candidates) =>
      candidates.filter((candidate) => candidate.id === 1),
    );

    const result = await searchRepositoryPages({
      start: { installationPage: 1, repositoryPage: 1 },
      search: "web",
      perPage: 100,
      maxListCalls: 10,
      matchTarget: 20,
      openInstallation: source.openInstallation,
    });

    expect(result.groups).toEqual([
      { installation: 1, repositories: [repo(1, "web")] },
    ]);
  });

  it("skips authorization when a page has no matches", async () => {
    const source = installations([[[repo(1, "api")]]]);

    const result = await searchRepositoryPages({
      start: { installationPage: 1, repositoryPage: 1 },
      search: "web",
      perPage: 100,
      maxListCalls: 10,
      matchTarget: 20,
      openInstallation: source.openInstallation,
    });

    expect(source.authorize).not.toHaveBeenCalled();
    expect(result).toEqual({ groups: [], nextPage: null });
  });

  it("stops at the list budget and returns a cursor to resume from", async () => {
    const pages = Array.from({ length: 5 }, (_, index) =>
      filler(index * 100 + 1, 100),
    );
    const source = installations([pages]);

    const result = await searchRepositoryPages({
      start: { installationPage: 1, repositoryPage: 2 },
      search: "web",
      perPage: 100,
      maxListCalls: 3,
      matchTarget: 20,
      openInstallation: source.openInstallation,
    });

    expect(source.listRepositories.mock.calls).toEqual([
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    expect(result).toEqual({
      groups: [],
      nextPage: { installationPage: 1, repositoryPage: 5 },
    });
  });

  it("returns early once enough matches are found", async () => {
    const source = installations([
      [
        [
          ...filler(1, 90),
          ...Array.from({ length: 10 }, (_, i) => repo(500 + i, `web-${i}`)),
        ],
        filler(101, 100),
      ],
    ]);

    const result = await searchRepositoryPages({
      start: { installationPage: 1, repositoryPage: 1 },
      search: "web",
      perPage: 100,
      maxListCalls: 10,
      matchTarget: 10,
      openInstallation: source.openInstallation,
    });

    expect(source.listRepositories).toHaveBeenCalledTimes(1);
    expect(result.groups[0]?.repositories).toHaveLength(10);
    expect(result.nextPage).toEqual({ installationPage: 1, repositoryPage: 2 });
  });

  it("never returns the same repository twice", async () => {
    const source = installations([
      [[repo(1, "web")]],
      [[repo(1, "web"), repo(2, "web-two")]],
    ]);

    const result = await searchRepositoryPages({
      start: { installationPage: 1, repositoryPage: 1 },
      search: "web",
      perPage: 100,
      maxListCalls: 10,
      matchTarget: 20,
      openInstallation: source.openInstallation,
    });

    expect(
      result.groups.flatMap((group) => group.repositories.map((r) => r.id)),
    ).toEqual([1, 2]);
  });
});
