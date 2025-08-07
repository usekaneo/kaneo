import { giteaApiCall } from "../utils/create-gitea-client";

interface GiteaRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  has_issues: boolean;
  has_wiki: boolean;
  has_projects: boolean;
  created_at: string;
  updated_at: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

async function listGiteaRepositories(
  giteaUrl: string,
  accessToken?: string,
): Promise<GiteaRepository[]> {
  try {
    const client = {
      url: giteaUrl,
      token: accessToken,
      owner: "",
      repo: "",
    };

    // Get user's repositories
    const repositories = await giteaApiCall<GiteaRepository[]>(
      client,
      "user/repos?limit=100",
    );

    // Filter repositories that have issues enabled
    return repositories.filter((repo) => repo.has_issues);
  } catch (error) {
    console.error("Failed to fetch Gitea repositories:", error);
    return [];
  }
}

export default listGiteaRepositories;
