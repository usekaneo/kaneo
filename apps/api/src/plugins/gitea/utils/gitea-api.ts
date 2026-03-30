import type { GiteaConfig } from "../config";
import { normalizeGiteaBaseUrl } from "../config";

export type GiteaLabel = {
  id: number;
  name: string;
  color?: string;
};

export type GiteaIssue = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  labels?: GiteaLabel[];
  user?: { login?: string; username?: string; avatar_url?: string } | null;
  pull_request?: unknown;
};

export type GiteaComment = {
  id: number;
  body: string;
  html_url: string;
  user?: { login?: string; username?: string; avatar_url?: string } | null;
  created_at: string;
};

export type GiteaPullRequest = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  head?: { ref?: string };
  user?: { login?: string; username?: string; avatar_url?: string } | null;
  merged?: boolean;
  merged_at?: string | null;
};

export class GiteaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "GiteaApiError";
  }
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
  };
}

export async function giteaFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const root = normalizeGiteaBaseUrl(baseUrl);
  const url = `${root}/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...init?.headers,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new GiteaApiError(`Gitea API error ${res.status}`, res.status, text);
  }

  if (res.status === 204 || text === "") {
    return undefined;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GiteaApiError(
      "Gitea API returned invalid JSON",
      res.status,
      text,
    );
  }
}

export function createGiteaClient(
  config: Pick<GiteaConfig, "baseUrl" | "accessToken">,
) {
  const { baseUrl, accessToken } = config;
  const owner = (o: string, r: string) =>
    `/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`;

  return {
    async getRepo(
      repositoryOwner: string,
      repositoryName: string,
    ): Promise<{
      name: string;
      owner: { login?: string; username?: string };
      html_url: string;
      private: boolean;
      permissions?: { admin?: boolean; push?: boolean; pull?: boolean };
    }> {
      const repo = await giteaFetch<{
        name: string;
        owner: { login?: string; username?: string };
        html_url: string;
        private: boolean;
        permissions?: { admin?: boolean; push?: boolean; pull?: boolean };
      }>(baseUrl, accessToken, owner(repositoryOwner, repositoryName));
      if (!repo) {
        throw new GiteaApiError("Gitea repository response was empty", 500);
      }
      return repo;
    },

    async listUserRepos(
      page = 1,
      limit = 50,
    ): Promise<
      Array<{
        id: number;
        name: string;
        full_name: string;
        owner: { login?: string; username?: string };
        private: boolean;
        html_url: string;
      }>
    > {
      const repos = await giteaFetch<
        Array<{
          id: number;
          name: string;
          full_name: string;
          owner: { login?: string; username?: string };
          private: boolean;
          html_url: string;
        }>
      >(baseUrl, accessToken, `/user/repos?page=${page}&limit=${limit}`);
      if (!repos) {
        throw new GiteaApiError("Gitea repositories response was empty", 500);
      }
      return repos;
    },

    async createIssue(
      repositoryOwner: string,
      repositoryName: string,
      body: { title: string; body?: string | null; closed?: boolean },
    ): Promise<GiteaIssue> {
      const issue = await giteaFetch<GiteaIssue>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (!issue) {
        throw new GiteaApiError("Gitea create issue response was empty", 500);
      }
      return issue;
    },

    async updateIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      body: Record<string, unknown>,
    ): Promise<GiteaIssue> {
      const issue = await giteaFetch<GiteaIssue>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      if (!issue) {
        throw new GiteaApiError("Gitea update issue response was empty", 500);
      }
      return issue;
    },

    async listIssueComments(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      page: number,
      limit: number,
    ): Promise<GiteaComment[]> {
      const comments = await giteaFetch<GiteaComment[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}/comments?page=${page}&limit=${limit}`,
      );
      if (!comments) {
        throw new GiteaApiError("Gitea comments response was empty", 500);
      }
      return comments;
    },

    async createIssueComment(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      body: string,
    ): Promise<GiteaComment> {
      const comment = await giteaFetch<GiteaComment>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      if (!comment) {
        throw new GiteaApiError("Gitea create comment response was empty", 500);
      }
      return comment;
    },

    async listLabels(
      repositoryOwner: string,
      repositoryName: string,
    ): Promise<GiteaLabel[]> {
      const labels = await giteaFetch<GiteaLabel[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/labels`,
      );
      if (!labels) {
        throw new GiteaApiError("Gitea labels response was empty", 500);
      }
      return labels;
    },

    async createLabel(
      repositoryOwner: string,
      repositoryName: string,
      name: string,
      color: string,
    ): Promise<GiteaLabel> {
      const label = await giteaFetch<GiteaLabel>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/labels`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            color: color.replace(/^#/, ""),
          }),
        },
      );
      if (!label) {
        throw new GiteaApiError("Gitea create label response was empty", 500);
      }
      return label;
    },

    async addLabelsToIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      labelIds: number[],
    ) {
      if (labelIds.length === 0) return;
      await giteaFetch<unknown>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}/labels`,
        {
          method: "POST",
          body: JSON.stringify(labelIds),
        },
      );
    },

    async replaceIssueLabels(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      labelIds: number[],
    ) {
      await giteaFetch<unknown>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}/labels`,
        {
          method: "PUT",
          body: JSON.stringify(labelIds),
        },
      );
    },

    async removeLabelFromIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      labelId: number,
    ) {
      await giteaFetch<unknown>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}/labels/${labelId}`,
        {
          method: "DELETE",
        },
      );
    },

    async getIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
    ): Promise<GiteaIssue> {
      const issue = await giteaFetch<GiteaIssue>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}`,
      );
      if (!issue) {
        throw new GiteaApiError("Gitea issue response was empty", 500);
      }
      return issue;
    },

    async listIssues(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
      state: "open" | "closed" | "all",
    ): Promise<GiteaIssue[]> {
      const issues = await giteaFetch<GiteaIssue[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues?state=${state}&page=${page}&limit=100`,
      );
      if (!issues) {
        throw new GiteaApiError("Gitea issues response was empty", 500);
      }
      return issues;
    },

    async listPulls(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
    ): Promise<GiteaPullRequest[]> {
      const pulls = await giteaFetch<GiteaPullRequest[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/pulls?state=open&page=${page}&limit=100`,
      );
      if (!pulls) {
        throw new GiteaApiError("Gitea pull requests response was empty", 500);
      }
      return pulls;
    },
  };
}

export async function verifyGiteaToken(baseUrl: string, token: string) {
  const user = await giteaFetch<{ id: number; login: string }>(
    normalizeGiteaBaseUrl(baseUrl),
    token,
    "/user",
  );
  if (!user) {
    throw new GiteaApiError("Gitea user response was empty", 500);
  }
  return user;
}
