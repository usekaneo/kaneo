import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetProject, mockVerifyToken } = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockVerifyToken: vi.fn(),
}));

// Stub GitlabApiError locally; the controller branches on `instanceof` + `.kind`.
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
  gitlabFetch: vi.fn(),
  createGitlabClient: () => ({
    getProject: (...args: unknown[]) => mockGetProject(...args),
  }),
  verifyGitlabToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

const { default: verifyGitlabAccess } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/verify-gitlab-access"
);

const input = {
  baseUrl: "https://gitlab.example",
  accessToken: "token",
  namespace: "acme",
  projectPath: "my-app",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyToken.mockResolvedValue({ id: 1, username: "owner" });
});

describe("verifyGitlabAccess", () => {
  it("succeeds when the token holds at least Developer on the project", async () => {
    mockGetProject.mockResolvedValue({
      id: 7,
      visibility: "private",
      permissions: { project_access: { access_level: 30 } },
    });

    await expect(verifyGitlabAccess(input)).resolves.toMatchObject({
      isInstalled: true,
      hasRequiredPermissions: true,
      projectExists: true,
      projectPrivate: true,
      missingPermissions: [],
      failureReason: null,
    });
  });

  it("accepts access inherited from the group", async () => {
    mockGetProject.mockResolvedValue({
      id: 7,
      visibility: "public",
      permissions: {
        project_access: null,
        group_access: { access_level: 40 },
      },
    });

    await expect(verifyGitlabAccess(input)).resolves.toMatchObject({
      hasRequiredPermissions: true,
      projectPrivate: false,
    });
  });

  it("flags a token that can only report on the project", async () => {
    mockGetProject.mockResolvedValue({
      id: 7,
      visibility: "private",
      permissions: { project_access: { access_level: 20 } },
    });

    await expect(verifyGitlabAccess(input)).resolves.toMatchObject({
      isInstalled: true,
      hasRequiredPermissions: false,
      missingPermissions: ["Developer role or higher"],
      failureReason: null,
    });
  });

  it("reports a redirect distinctly so the user can fix the URL", async () => {
    mockGetProject.mockRejectedValue(
      new GitlabApiError(
        "GitLab request was redirected (HTTP 308)",
        308,
        "REDIRECT",
      ),
    );

    const result = await verifyGitlabAccess(input);
    expect(result.failureReason).toBe("redirected");
    expect(result.message).toContain("308");
  });

  it("treats a 404 from /user as not a GitLab instance", async () => {
    mockVerifyToken.mockRejectedValue(
      new GitlabApiError("GitLab API error 404", 404, "HTTP_ERROR"),
    );

    await expect(verifyGitlabAccess(input)).resolves.toMatchObject({
      isInstalled: false,
      failureReason: "not_a_gitlab_instance",
    });
  });

  it("treats non-JSON as not a GitLab instance", async () => {
    mockVerifyToken.mockRejectedValue(
      new GitlabApiError(
        "GitLab API returned invalid JSON",
        200,
        "INVALID_JSON",
      ),
    );

    await expect(verifyGitlabAccess(input)).resolves.toMatchObject({
      isInstalled: false,
      failureReason: "not_a_gitlab_instance",
    });
  });

  it("separates a reachable instance from a missing project", async () => {
    mockGetProject.mockRejectedValue(
      new GitlabApiError("GitLab API error 404", 404, "HTTP_ERROR"),
    );

    await expect(verifyGitlabAccess(input)).resolves.toMatchObject({
      isInstalled: true,
      projectExists: false,
      failureReason: "project_not_found",
    });
  });

  it("raises 401 when the token is rejected", async () => {
    mockGetProject.mockRejectedValue(
      new GitlabApiError("GitLab API error 401", 401, "HTTP_ERROR"),
    );

    await expect(verifyGitlabAccess(input)).rejects.toMatchObject({
      status: 401,
    });
  });
});
