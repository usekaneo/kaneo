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
): Promise<T> {
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
    return undefined as T;
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
    async getRepo(repositoryOwner: string, repositoryName: string) {
      return giteaFetch<{
        name: string;
        owner: { login?: string; username?: string };
        html_url: string;
        private: boolean;
        permissions?: { admin?: boolean; push?: boolean; pull?: boolean };
      }>(baseUrl, accessToken, owner(repositoryOwner, repositoryName));
    },

    async listUserRepos(page = 1, limit = 50) {
      return giteaFetch<
        Array<{
          id: number;
          name: string;
          full_name: string;
          owner: { login?: string; username?: string };
          private: boolean;
          html_url: string;
        }>
      >(baseUrl, accessToken, `/user/repos?page=${page}&limit=${limit}`);
    },

    async createIssue(
      repositoryOwner: string,
      repositoryName: string,
      body: { title: string; body?: string | null; closed?: boolean },
    ) {
      return giteaFetch<GiteaIssue>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },

    async updateIssue(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      body: Record<string, unknown>,
    ) {
      return giteaFetch<GiteaIssue>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
    },

    async listIssueComments(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      page: number,
      limit: number,
    ) {
      return giteaFetch<GiteaComment[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}/comments?page=${page}&limit=${limit}`,
      );
    },

    async createIssueComment(
      repositoryOwner: string,
      repositoryName: string,
      index: number,
      body: string,
    ) {
      return giteaFetch<GiteaComment>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
    },

    async listLabels(repositoryOwner: string, repositoryName: string) {
      return giteaFetch<GiteaLabel[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/labels`,
      );
    },

    async createLabel(
      repositoryOwner: string,
      repositoryName: string,
      name: string,
      color: string,
    ) {
      return giteaFetch<GiteaLabel>(
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
    ) {
      return giteaFetch<GiteaIssue>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues/${index}`,
      );
    },

    async listIssues(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
      state: "open" | "closed" | "all",
    ) {
      return giteaFetch<GiteaIssue[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/issues?state=${state}&page=${page}&limit=100`,
      );
    },

    async listPulls(
      repositoryOwner: string,
      repositoryName: string,
      page: number,
    ) {
      return giteaFetch<GiteaPullRequest[]>(
        baseUrl,
        accessToken,
        `${owner(repositoryOwner, repositoryName)}/pulls?state=open&page=${page}&limit=100`,
      );
    },
  };
}

export async function verifyGiteaToken(baseUrl: string, token: string) {
  return giteaFetch<{ id: number; login: string }>(
    normalizeGiteaBaseUrl(baseUrl),
    token,
    "/user",
  );
}
