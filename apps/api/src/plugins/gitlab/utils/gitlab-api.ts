import * as Sentry from "@sentry/node";
import { assertPublicDestination } from "../../../utils/assert-public-destination";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl, projectFullPath } from "../config";

export type GitlabLabel = {
  id: number;
  name: string;
  color?: string;
};

export type GitlabUser = {
  id?: number;
  username?: string;
  name?: string;
  avatar_url?: string | null;
};

export type GitlabIssue = {
  id: number;
  /** Project-scoped number shown in the UI; `id` is instance-wide. */
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  updated_at?: string;
  labels?: Array<string | GitlabLabel>;
  author?: GitlabUser | null;
};

export type GitlabNote = {
  id: number;
  body: string;
  author?: GitlabUser | null;
  created_at: string;
  /** GitLab emits its own activity (label changes, closes) as system notes. */
  system?: boolean;
};

export type GitlabMergeRequest = {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  web_url: string;
  state: string;
  draft?: boolean;
  work_in_progress?: boolean;
  source_branch?: string;
  author?: GitlabUser | null;
  merged_at?: string | null;
};

export type GitlabProject = {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  namespace?: { full_path?: string };
  visibility?: string;
  web_url: string;
  permissions?: {
    project_access?: { access_level?: number } | null;
    group_access?: { access_level?: number } | null;
  };
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

export type GitlabTokenType = "pat" | "oauth2";

function authHeaders(token: string, tokenType: GitlabTokenType): HeadersInit {
  return {
    // Personal, project, and group access tokens use PRIVATE-TOKEN; an OAuth2
    // token is only accepted as a bearer credential.
    ...(tokenType === "oauth2"
      ? { Authorization: `Bearer ${token}` }
      : { "PRIVATE-TOKEN": token }),
    "Content-Type": "application/json",
  };
}

const GITLAB_FETCH_TIMEOUT_MS = 10_000;

export async function gitlabFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit & { tokenType?: GitlabTokenType },
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
        ...authHeaders(token, init?.tokenType ?? "pat"),
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

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new GitlabApiError(
      `GitLab ${what} response was empty`,
      500,
      "EMPTY_RESPONSE",
    );
  }
  return value;
}

export function createGitlabClient(
  config: Pick<
    GitlabConfig,
    "baseUrl" | "accessToken" | "tokenType" | "namespace" | "projectPath"
  >,
) {
  const { baseUrl, accessToken } = config;
  const tokenType: GitlabTokenType = config.tokenType ?? "pat";
  const projectRef = encodeURIComponent(projectFullPath(config));
  const call = <T>(path: string, init?: RequestInit) =>
    gitlabFetch<T>(baseUrl, accessToken, path, { ...init, tokenType });

  return {
    async getProject(): Promise<GitlabProject> {
      return required(
        await call<GitlabProject>(`/projects/${projectRef}`),
        "project",
      );
    },

    async getIssue(iid: number): Promise<GitlabIssue> {
      return required(
        await call<GitlabIssue>(`/projects/${projectRef}/issues/${iid}`),
        "issue",
      );
    },

    async listIssues(
      page: number,
      state: "opened" | "closed" | "all",
      perPage = 100,
    ): Promise<GitlabIssue[]> {
      return required(
        await call<GitlabIssue[]>(
          `/projects/${projectRef}/issues?state=${state}&with_labels_details=true&per_page=${perPage}&page=${page}`,
        ),
        "issues",
      );
    },

    async createIssue(body: {
      title: string;
      description?: string | null;
    }): Promise<GitlabIssue> {
      return required(
        await call<GitlabIssue>(`/projects/${projectRef}/issues`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
        "create issue",
      );
    },

    async updateIssue(
      iid: number,
      body: Record<string, unknown>,
    ): Promise<GitlabIssue> {
      return required(
        await call<GitlabIssue>(`/projects/${projectRef}/issues/${iid}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }),
        "update issue",
      );
    },

    async listIssueNotes(
      iid: number,
      page: number,
      perPage: number,
    ): Promise<GitlabNote[]> {
      return required(
        await call<GitlabNote[]>(
          `/projects/${projectRef}/issues/${iid}/notes?per_page=${perPage}&page=${page}&sort=asc&order_by=created_at`,
        ),
        "notes",
      );
    },

    async createIssueNote(iid: number, body: string): Promise<GitlabNote> {
      return required(
        await call<GitlabNote>(`/projects/${projectRef}/issues/${iid}/notes`, {
          method: "POST",
          body: JSON.stringify({ body }),
        }),
        "create note",
      );
    },

    async listLabels(page = 1, perPage = 100): Promise<GitlabLabel[]> {
      return required(
        await call<GitlabLabel[]>(
          `/projects/${projectRef}/labels?per_page=${perPage}&page=${page}`,
        ),
        "labels",
      );
    },

    async createLabel(name: string, color: string): Promise<GitlabLabel> {
      return required(
        await call<GitlabLabel>(`/projects/${projectRef}/labels`, {
          method: "POST",
          body: JSON.stringify({ name, color: `#${color.replace(/^#/, "")}` }),
        }),
        "create label",
      );
    },

    /** GitLab edits issue labels by name through the issue itself. */
    async addLabelsToIssue(iid: number, labelNames: string[]) {
      if (labelNames.length === 0) return;
      await call<unknown>(`/projects/${projectRef}/issues/${iid}`, {
        method: "PUT",
        body: JSON.stringify({ add_labels: labelNames.join(",") }),
      });
    },

    async removeLabelsFromIssue(iid: number, labelNames: string[]) {
      if (labelNames.length === 0) return;
      await call<unknown>(`/projects/${projectRef}/issues/${iid}`, {
        method: "PUT",
        body: JSON.stringify({ remove_labels: labelNames.join(",") }),
      });
    },

    async listMergeRequests(
      page: number,
      state: "opened" | "closed" | "merged" | "all",
      perPage = 100,
    ): Promise<GitlabMergeRequest[]> {
      return required(
        await call<GitlabMergeRequest[]>(
          `/projects/${projectRef}/merge_requests?state=${state}&per_page=${perPage}&page=${page}`,
        ),
        "merge requests",
      );
    },
  };
}

export async function verifyGitlabToken(
  baseUrl: string,
  token: string,
  tokenType: GitlabTokenType = "pat",
) {
  const user = await gitlabFetch<{ id: number; username: string }>(
    normalizeGitlabBaseUrl(baseUrl),
    token,
    "/user",
    { tokenType },
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

/** Not project-scoped, so it takes credentials rather than a linked project. */
export async function listGitlabMemberProjects(
  baseUrl: string,
  token: string,
  tokenType: GitlabTokenType,
  page: number,
  perPage: number,
): Promise<GitlabProject[]> {
  return required(
    await gitlabFetch<GitlabProject[]>(
      baseUrl,
      token,
      `/projects?membership=true&order_by=last_activity_at&per_page=${perPage}&page=${page}`,
      { tokenType },
    ),
    "projects",
  );
}
