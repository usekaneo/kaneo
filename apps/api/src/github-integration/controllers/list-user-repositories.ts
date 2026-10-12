import { HTTPException } from "hono/http-exception";
import { getGithubApp } from "../../plugins/github/utils/github-app";
import {
  nextRepositoryPage,
  type RepositoryPage,
  searchRepositoryPages,
} from "../repository-search";
import { getGithubAccount } from "./verify-repository-owner";

export type { RepositoryPage } from "../repository-search";

const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 100;
const SEARCH_MAX_LIST_CALLS = 10;
const SEARCH_MATCH_TARGET = 20;
const PERMISSION_CHECK_CONCURRENCY = 4;

type GithubApp = NonNullable<ReturnType<typeof getGithubApp>>;
type ListedInstallation = Awaited<
  ReturnType<GithubApp["octokit"]["rest"]["apps"]["listInstallations"]>
>["data"][number];
type CandidateRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string; avatar_url: string; type: string };
  description: string | null;
  html_url: string;
  updated_at?: string | null;
};
type PermissionLookup = (owner: string, repo: string) => Promise<string>;

const request = { timeout: 10_000 };

async function authorizeRepository(
  lookup: PermissionLookup,
  installationId: number,
  repo: CandidateRepository,
) {
  try {
    if ((await lookup(repo.owner.login, repo.name)) !== "admin") return null;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw new HTTPException(502, {
      message: "GitHub access verification is temporarily unavailable",
    });
  }
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    private: repo.private,
    owner: {
      login: repo.owner.login,
      avatar_url: repo.owner.avatar_url,
      type: repo.owner.type,
    },
    description: repo.description,
    html_url: repo.html_url,
    updated_at: repo.updated_at ?? "",
    installation_id: installationId,
  };
}

async function authorizeRepositories(
  lookup: PermissionLookup,
  installationId: number,
  candidates: CandidateRepository[],
) {
  const repositories = [];
  for (
    let offset = 0;
    offset < candidates.length;
    offset += PERMISSION_CHECK_CONCURRENCY
  ) {
    const batch = candidates.slice(
      offset,
      offset + PERMISSION_CHECK_CONCURRENCY,
    );
    const authorized = await Promise.all(
      batch.map((repo) => authorizeRepository(lookup, installationId, repo)),
    );
    repositories.push(...authorized.filter((repo) => repo !== null));
  }
  return repositories;
}

async function openInstallation(
  app: GithubApp,
  accountId: string,
  installationPage: number,
) {
  const { data: installations } = await app.octokit.rest.apps.listInstallations(
    {
      per_page: 1,
      page: installationPage,
      request,
    },
  );
  const installation: ListedInstallation | undefined = installations[0];
  if (!installation) return null;
  const octokit = await app.getInstallationOctokit(installation.id);
  const { data: identity } = await octokit.rest.users.getById({
    account_id: Number(accountId),
    request,
  });
  if (String(identity.id) !== accountId)
    throw new HTTPException(403, {
      message: "GitHub identity could not be verified",
    });
  const lookup: PermissionLookup = async (owner, repo) => {
    const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: identity.login,
      request,
    });
    return data.permission;
  };
  return {
    installation,
    listRepositories: async (
      repositoryPage: number,
      perPage: number,
    ): Promise<CandidateRepository[]> => {
      const { data } =
        await octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: perPage,
          page: repositoryPage,
          request,
        });
      return data.repositories;
    },
    authorize: (candidates: CandidateRepository[]) =>
      authorizeRepositories(lookup, installation.id, candidates),
  };
}

function describeInstallation(
  installation: ListedInstallation,
  repositories: { full_name: string }[],
) {
  return {
    id: installation.id,
    account: installation.account,
    repositories: repositories.map((repo) => repo.full_name),
  };
}

async function listUserRepositories(
  userId: string,
  page: RepositoryPage,
  search?: string,
) {
  const account = await getGithubAccount(userId);
  const app = getGithubApp(true);
  if (!app)
    throw new HTTPException(503, {
      message: "GitHub integration is unavailable",
    });

  if (search) {
    const { groups, nextPage } = await searchRepositoryPages({
      start: page,
      search,
      perPage: SEARCH_PAGE_SIZE,
      maxListCalls: SEARCH_MAX_LIST_CALLS,
      matchTarget: SEARCH_MATCH_TARGET,
      openInstallation: async (installationPage) => {
        const source = await openInstallation(
          app,
          account.accountId,
          installationPage,
        );
        if (!source) return null;
        return {
          installation: source.installation,
          listRepositories: (repositoryPage) =>
            source.listRepositories(repositoryPage, SEARCH_PAGE_SIZE),
          authorize: source.authorize,
        };
      },
    });
    const repositories = groups.flatMap((group) => group.repositories);
    return {
      repositories,
      installations: groups.map((group) =>
        describeInstallation(group.installation, group.repositories),
      ),
      total: repositories.length,
      nextPage,
    };
  }

  const source = await openInstallation(
    app,
    account.accountId,
    page.installationPage,
  );
  if (!source)
    return { repositories: [], installations: [], total: 0, nextPage: null };
  const fetched = await source.listRepositories(page.repositoryPage, PAGE_SIZE);
  const repositories = await source.authorize(fetched);
  return {
    repositories,
    installations: repositories.length
      ? [describeInstallation(source.installation, repositories)]
      : [],
    total: repositories.length,
    nextPage: nextRepositoryPage(page, fetched.length, PAGE_SIZE),
  };
}
export default listUserRepositories;
