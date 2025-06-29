import { HTTPException } from "hono/http-exception";
import createGithubApp from "../utils/create-github-app";

const githubApp = createGithubApp();

async function listUserRepositories() {
  if (!githubApp) {
    throw new HTTPException(500, {
      message: "GitHub app not found",
    });
  }

  try {
    const { data: installations } =
      await githubApp.octokit.rest.apps.listInstallations();

    const installationsWithRepos = await Promise.all(
      installations.map(async (installation) => {
        try {
          const installationOctokit = await githubApp.getInstallationOctokit(
            installation.id,
          );
          const { data: repos } =
            await installationOctokit.rest.apps.listReposAccessibleToInstallation(
              {
                per_page: 500,
              },
            );

          return {
            id: installation.id,
            account: installation.account
              ? {
                  login: installation.account.login,
                  type: installation.account.type,
                }
              : null,
            repositories: repos.repositories.map((repo) => repo.full_name),
          };
        } catch (error) {
          console.warn(
            `Failed to get repositories for installation ${installation.id}:`,
            error,
          );
          return {
            id: installation.id,
            account: installation.account
              ? {
                  login: installation.account.login,
                  type: installation.account.type,
                }
              : null,
            repositories: [],
          };
        }
      }),
    );

    const allRepositories = [];

    for (const installation of installations) {
      try {
        const installationOctokit = await githubApp.getInstallationOctokit(
          installation.id,
        );
        const { data: repos } =
          await installationOctokit.rest.apps.listReposAccessibleToInstallation();

        const mappedRepos = repos.repositories.map((repo) => ({
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
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

    return {
      repositories: uniqueRepositories,
      installations: installationsWithRepos,
    };
  } catch (error) {
    console.error("Failed to list user repositories:", error);
    throw new HTTPException(500, {
      message: "Failed to fetch repositories from GitHub",
    });
  }
}

export default listUserRepositories;
