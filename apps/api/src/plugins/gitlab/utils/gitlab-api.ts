import * as Sentry from "@sentry/node";
import { assertPublicDestination } from "../../../utils/assert-public-destination";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl } from "../config";

export type GitlabLabel = {
  id: number;
  name: string;
  color?: string;
};

export type GitlabIssue = {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  labels?: string[];
  author?: { username?: string; avatar_url?: string } | null;
};

export type GitlabNote = {
  id: number;
  body: string;
  author?: { username?: string; avatar_url?: string } | null;
  created_at: string;
};

export type GitlabMergeRequest = {
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  source_branch: string;
  author?: { username?: string; avatar_url?: string } | null;
  merged_at?: string | null;
};

export type GitlabApiErrorKind =
  | "REDIRECT"
  | "INVALID_JSON"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "EMPTY_RESPONSE";

export class GitlabApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: GitlabApiErrorKind,
    public body?: string,
  ) {
    super(message);
    this.name = "GitlabApiError";
  }
}

function authHeaders(token: string): HeadersInit {
  return {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };
}

const GITLAB_FETCH_TIMEOUT_MS = 10_000;

export async function gitlabFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const root = normalizeGitlabBaseUrl(baseUrl);
  const url = `${root}/api/v4${path.startsWith("/") ? path : `/${path}`}`;

  await assertPublicDestination(root, "GitLab");

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GITLAB_FETCH_TIMEOUT_MS);
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    Sentry.addBreadcrumb({
      category: "integration",
      level: "info",
      data: { integration: "gitlab" },
    });
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Following redirects would let a public host bounce the request to an
      // internal address after the destination check has already passed.
      redirect: "manual",
      headers: {
        ...authHeaders(token),
        ...init?.headers,
      },
    });

    if (res.status >= 300 && res.status < 400) {
      throw new GitlabApiError(
        `GitLab request was redirected (HTTP ${res.status})`,
        res.status,
        "REDIRECT",
      );
    }

    const text = await res.text();
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new GitlabApiError(
        `GitLab API error ${res.status}`,
        res.status,
        "HTTP_ERROR",
        text,
      );
    }

    if (res.status === 204 || text === "") {
      return undefined;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GitlabApiError(
        "GitLab API returned invalid JSON",
        res.status,
        "INVALID_JSON",
        text,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof GitlabApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        throw new GitlabApiError(
          `GitLab request timed out after ${GITLAB_FETCH_TIMEOUT_MS}ms`,
          408,
          "TIMEOUT",
        );
      }
      throw error;
    }
    throw error;
  }
}

export function createGitlabClient(
  config: Pick<GitlabConfig, "baseUrl" | "accessToken">,
) {
  const { baseUrl, accessToken } = config;
  const project = (repositoryPath: string) =>
    `/projects/${encodeURIComponent(repositoryPath)}`;

  return {
    async getProject(repositoryPath: string): Promise<{
      id: number;
      path_with_namespace: string;
      web_url: string;
      visibility: string;
      permissions?: {
        project_access?: { access_level: number } | null;
        group_access?: { access_level: number } | null;
      };
    }> {
      const repo = await gitlabFetch<{
        id: number;
        path_with_namespace: string;
        web_url: string;
        visibility: string;
        permissions?: {
          project_access?: { access_level: number } | null;
          group_access?: { access_level: number } | null;
        };
      }>(baseUrl, accessToken, project(repositoryPath));
      if (!repo) {
        throw new GitlabApiError(
          "GitLab project response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return repo;
    },

    async listUserProjects(
      page = 1,
      perPage = 50,
    ): Promise<
      Array<{
        id: number;
        name: string;
        path_with_namespace: string;
        visibility: string;
        web_url: string;
      }>
    > {
      const projects = await gitlabFetch<
        Array<{
          id: number;
          name: string;
          path_with_namespace: string;
          visibility: string;
          web_url: string;
        }>
      >(
        baseUrl,
        accessToken,
        `/projects?membership=true&page=${page}&per_page=${perPage}`,
      );
      if (!projects) {
        throw new GitlabApiError(
          "GitLab projects response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return projects;
    },

    async createIssue(
      repositoryPath: string,
      body: { title: string; description?: string | null },
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (!issue) {
        throw new GitlabApiError(
          "GitLab create issue response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issue;
    },

    async updateIssue(
      repositoryPath: string,
      issueIid: number,
      body: Record<string, unknown>,
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
      if (!issue) {
        throw new GitlabApiError(
          "GitLab update issue response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issue;
    },

    async listIssueNotes(
      repositoryPath: string,
      issueIid: number,
      page: number,
      perPage: number,
    ): Promise<GitlabNote[]> {
      const notes = await gitlabFetch<GitlabNote[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}/notes?page=${page}&per_page=${perPage}&order_by=created_at&sort=asc`,
      );
      if (!notes) {
        throw new GitlabApiError(
          "GitLab notes response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return notes;
    },

    async createIssueNote(
      repositoryPath: string,
      issueIid: number,
      body: string,
    ): Promise<GitlabNote> {
      const note = await gitlabFetch<GitlabNote>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      if (!note) {
        throw new GitlabApiError(
          "GitLab create note response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return note;
    },

    async listLabels(repositoryPath: string): Promise<GitlabLabel[]> {
      const labels = await gitlabFetch<GitlabLabel[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/labels`,
      );
      if (!labels) {
        throw new GitlabApiError(
          "GitLab labels response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return labels;
    },

    async createLabel(
      repositoryPath: string,
      name: string,
      color: string,
    ): Promise<GitlabLabel> {
      const label = await gitlabFetch<GitlabLabel>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/labels`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            color: color.startsWith("#") ? color : `#${color}`,
          }),
        },
      );
      if (!label) {
        throw new GitlabApiError(
          "GitLab create label response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return label;
    },

    async getIssue(
      repositoryPath: string,
      issueIid: number,
    ): Promise<GitlabIssue> {
      const issue = await gitlabFetch<GitlabIssue>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues/${issueIid}`,
      );
      if (!issue) {
        throw new GitlabApiError(
          "GitLab issue response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issue;
    },

    async listIssues(
      repositoryPath: string,
      page: number,
      state: "opened" | "closed" | "all",
    ): Promise<GitlabIssue[]> {
      const issues = await gitlabFetch<GitlabIssue[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/issues?state=${state}&page=${page}&per_page=100`,
      );
      if (!issues) {
        throw new GitlabApiError(
          "GitLab issues response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return issues;
    },

    async listMergeRequests(
      repositoryPath: string,
      page: number,
    ): Promise<GitlabMergeRequest[]> {
      const mrs = await gitlabFetch<GitlabMergeRequest[]>(
        baseUrl,
        accessToken,
        `${project(repositoryPath)}/merge_requests?state=opened&page=${page}&per_page=100`,
      );
      if (!mrs) {
        throw new GitlabApiError(
          "GitLab merge requests response was empty",
          500,
          "EMPTY_RESPONSE",
        );
      }
      return mrs;
    },
  };
}

export async function verifyGitlabToken(baseUrl: string, token: string) {
  const user = await gitlabFetch<{ id: number; username: string }>(
    normalizeGitlabBaseUrl(baseUrl),
    token,
    "/user",
  );
  if (!user) {
    throw new GitlabApiError(
      "GitLab user response was empty",
      500,
      "EMPTY_RESPONSE",
    );
  }
  return user;
}
