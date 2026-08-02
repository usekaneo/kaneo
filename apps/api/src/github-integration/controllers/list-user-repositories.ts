import { HTTPException } from "hono/http-exception";
import {
  getGithubApp,
  getGithubOctokit,
} from "../../plugins/github/utils/github-app";

async function listUserRepositories(userId?: string) {
  const octokit = await getGithubOctokit(userId);
  const githubApp = getGithubApp();

  if (!octokit && !githubApp) {
    throw new HTTPException(400, {
      message:
        "GitHub not connected. Please link your GitHub account or configure GitHub App.",
    });
  }

  try {
    if (octokit) {
      const repos = await octokit.paginate(
        octokit.rest.repos.listForAuthenticatedUser,
        {
          per_page: 100,
          sort: "updated",
        },
      );

      const mappedRepos = repos.map((repo) => ({
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
        permissions: repo.permissions
          ? {
              admin: repo.permissions.admin,
              push: repo.permissions.push,
              pull: repo.permissions.pull,
            }
          : undefined,
        updated_at: repo.updated_at || new Date().toISOString(),
        installation_id: 1,
      }));

      return {
        repositories: mappedRepos,
        installations: [],
        total: mappedRepos.length,
      };
    }

    if (githubApp) {
      const { data: installations } =
        await githubApp.octokit.rest.apps.listInstallations();

      const allRepositories = [];
      const installationsWithRepos = [];

      for (const installation of installations) {
        try {
          const installationOctokit = await githubApp.getInstallationOctokit(
            installation.id,
          );

          const repos = await installationOctokit.paginate(
            installationOctokit.rest.apps.listReposAccessibleToInstallation,
            {
              per_page: 100,
            },
          );

          installationsWithRepos.push({
            id: installation.id,
            account: installation.account
              ? {
                  login: installation.account.login,
                  type: installation.account.type,
                }
              : null,
            repositories: repos.map((repo) => repo.full_name),
          });

          const mappedRepos = repos.map((repo) => ({
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
            permissions: repo.permissions
              ? {
                  admin: repo.permissions.admin,
                  push: repo.permissions.push,
                  pull: repo.permissions.pull,
                }
              : undefined,
            updated_at: repo.updated_at || new Date().toISOString(),
            installation_id: installation.id,
          }));

          allRepositories.push(...mappedRepos);
        } catch (error) {
          console.warn(
            `Failed to get repositories for installation ${installation.id}:`,
            error,
          );
        }
      }

      const uniqueRepositories = allRepositories
        .filter(
          (repo, index, self) =>
            index === self.findIndex((r) => r.id === repo.id),
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime(),
        );

      return {
        repositories: uniqueRepositories,
        installations: installationsWithRepos,
        total: uniqueRepositories.length,
      };
    }

    throw new HTTPException(400, { message: "GitHub connection not found" });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Failed to list user repositories:", error);
    throw new HTTPException(500, {
      message: "Failed to fetch repositories from GitHub",
    });
  }
}

export default listUserRepositories;
