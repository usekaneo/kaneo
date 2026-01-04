import { HTTPException } from "hono/http-exception";
import { getGithubApp } from "../../plugins/github/utils/github-app";

async function listUserRepositories() {
  const githubApp = getGithubApp();

  if (!githubApp) {
    throw new HTTPException(500, {
      message: "GitHub app not configured",
    });
  }

  try {
    const { data: installations } =
      await githubApp.octokit.rest.apps.listInstallations();

    const allRepositories = [];
    const installationsWithRepos = [];

    for (const installation of installations) {
      try {
        const installationOctokit = await githubApp.getInstallationOctokit(
          installation.id,
        );

        // Use pagination to fetch ALL repositories for this installation
        const repos = await installationOctokit.paginate(
          installationOctokit.rest.apps.listReposAccessibleToInstallation,
          {
            per_page: 100, // GitHub's maximum
          },
        );

        // Store installation info with repository names for UI
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
        // Still add installation info even if repo fetch fails
        installationsWithRepos.push({
          id: installation.id,
          account: installation.account
            ? {
                login: installation.account.login,
                type: installation.account.type,
              }
            : null,
          repositories: [],
        });
      }
    }

    // Remove duplicates and sort by most recently updated
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
      total: uniqueRepositories.length,
    };
  } catch (error) {
    console.error("Failed to list user repositories:", error);
    throw new HTTPException(500, {
      message: "Failed to fetch repositories from GitHub",
    });
  }
}

export default listUserRepositories;
