import { HTTPException } from "hono/http-exception";
import { getGithubApp } from "../../plugins/github/utils/github-app";
import { getGithubAccount } from "./verify-repository-owner";

export type RepositoryPage = {
  installationPage: number;
  repositoryPage: number;
};
const PAGE_SIZE = 20;

/** One bounded page. Never return other users' repository or installation metadata. */
async function listUserRepositories(userId: string, page: RepositoryPage) {
  const account = await getGithubAccount(userId);
  const app = getGithubApp(true);
  if (!app)
    throw new HTTPException(503, {
      message: "GitHub integration is unavailable",
    });
  const request = { timeout: 10_000 };
  const { data: installations } = await app.octokit.rest.apps.listInstallations(
    {
      per_page: 1,
      page: page.installationPage,
      request,
    },
  );
  const installation = installations[0];
  if (!installation)
    return { repositories: [], installations: [], total: 0, nextPage: null };
  const octokit = await app.getInstallationOctokit(installation.id);
  const { data: identity } = await octokit.rest.users.getById({
    account_id: Number(account.accountId),
    request,
  });
  if (String(identity.id) !== account.accountId)
    throw new HTTPException(403, {
      message: "GitHub identity could not be verified",
    });
  const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
    per_page: PAGE_SIZE,
    page: page.repositoryPage,
    request,
  });
  const repositories = [];
  // Bound concurrent requests as well as the total per page.
  for (let offset = 0; offset < data.repositories.length; offset += 4) {
    const candidates = data.repositories.slice(offset, offset + 4);
    const authorized = await Promise.all(
      candidates.map(async (repo) => {
        try {
          const { data: permission } =
            await octokit.rest.repos.getCollaboratorPermissionLevel({
              owner: repo.owner.login,
              repo: repo.name,
              username: identity.login,
              request,
            });
          if (permission.permission !== "admin") return null;
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
            installation_id: installation.id,
          };
        } catch (error) {
          if ((error as { status?: number }).status === 404) return null;
          throw new HTTPException(502, {
            message: "GitHub access verification is temporarily unavailable",
          });
        }
      }),
    );
    repositories.push(...authorized.filter((repo) => repo !== null));
  }
  return {
    repositories,
    installations: repositories.length
      ? [
          {
            id: installation.id,
            account: installation.account,
            repositories: repositories.map((repo) => repo.full_name),
          },
        ]
      : [],
    total: repositories.length,
    nextPage:
      data.repositories.length === PAGE_SIZE
        ? {
            installationPage: page.installationPage,
            repositoryPage: page.repositoryPage + 1,
          }
        : { installationPage: page.installationPage + 1, repositoryPage: 1 },
  };
}
export default listUserRepositories;
