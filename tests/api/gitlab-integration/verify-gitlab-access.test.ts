import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGitlabFetch } = vi.hoisted(() => ({
  mockGitlabFetch: vi.fn(),
}));

type GitlabApiErrorKind =
  | "REDIRECT"
  | "INVALID_JSON"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "EMPTY_RESPONSE";

class GitlabApiError extends Error {
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

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  GitlabApiError,
  gitlabFetch: (...args: unknown[]) => mockGitlabFetch(...args),
  createGitlabClient: () => ({
    getProject: (...args: unknown[]) => mockGitlabFetch(...args),
  }),
  verifyGitlabToken: (...args: unknown[]) => mockGitlabFetch(...args),
}));

const { default: verifyGitlabAccess } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/verify-gitlab-access"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyGitlabAccess", () => {
  it("returns success when the token has Developer+ access", async () => {
    mockGitlabFetch
      .mockResolvedValueOnce({ id: 1, username: "owner" })
      .mockResolvedValueOnce({
        id: 42,
        path_with_namespace: "group/project",
        web_url: "https://gitlab.example/group/project",
        visibility: "private",
        permissions: {
          project_access: { access_level: 30 },
          group_access: null,
        },
      });

    const result = await verifyGitlabAccess({
      baseUrl: "https://gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result).toMatchObject({
      isInstalled: true,
      hasRequiredPermissions: true,
      repositoryExists: true,
      repositoryPrivate: true,
      missingPermissions: [],
      message: "Token can access the project.",
      failureReason: null,
    });
  });

  it("flags insufficient permissions below Developer access", async () => {
    mockGitlabFetch
      .mockResolvedValueOnce({ id: 1, username: "owner" })
      .mockResolvedValueOnce({
        id: 42,
        path_with_namespace: "group/project",
        web_url: "https://gitlab.example/group/project",
        visibility: "public",
        permissions: {
          project_access: { access_level: 10 },
          group_access: null,
        },
      });

    const result = await verifyGitlabAccess({
      baseUrl: "https://gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result.hasRequiredPermissions).toBe(false);
    expect(result.missingPermissions).toEqual(["issues (write)"]);
  });

  it("returns a redirect-specific message when the URL redirects", async () => {
    mockGitlabFetch.mockRejectedValue(
      new GitlabApiError(
        "GitLab request was redirected (HTTP 308)",
        308,
        "REDIRECT",
      ),
    );

    const result = await verifyGitlabAccess({
      baseUrl: "http://gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("redirected");
    expect(result.message).toContain("HTTP 308");
  });

  it("returns 'not a GitLab instance' when the response is invalid JSON", async () => {
    mockGitlabFetch.mockRejectedValue(
      new GitlabApiError(
        "GitLab API returned invalid JSON",
        200,
        "INVALID_JSON",
      ),
    );

    const result = await verifyGitlabAccess({
      baseUrl: "https://not-gitlab.example",
      accessToken: "token",
      repositoryPath: "group/project",
    });

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("not_a_gitlab_instance");
  });
});
