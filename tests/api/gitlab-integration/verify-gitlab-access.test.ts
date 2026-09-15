import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGitlabFetch } = vi.hoisted(() => ({
  mockGitlabFetch: vi.fn(),
}));

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  GitlabApiError: class GitlabApiError extends Error {},
  verifyGitlabToken: (...args: unknown[]) => mockGitlabFetch(...args),
  createGitlabClient: () => ({
    getProject: (...args: unknown[]) => mockGitlabFetch(...args),
  }),
}));

const { default: verifyGitlabAccess } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/verify-gitlab-access"
);

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof HTTPException ? error.status : "not-http";
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyGitlabAccess input", () => {
  it("rejects a base URL with a query string as a bad request", async () => {
    const status = await statusOf(
      verifyGitlabAccess({
        baseUrl: "https://gitlab.example.com/?next=/admin",
        accessToken: "token",
        tokenType: "private",
        projectPath: "acme/web",
      }),
    );

    expect(status).toBe(400);
    expect(mockGitlabFetch).not.toHaveBeenCalled();
  });

  it("rejects a project path without a namespace as a bad request", async () => {
    const status = await statusOf(
      verifyGitlabAccess({
        baseUrl: "https://gitlab.com",
        accessToken: "token",
        tokenType: "private",
        projectPath: "web",
      }),
    );

    expect(status).toBe(400);
    expect(mockGitlabFetch).not.toHaveBeenCalled();
  });

  it("asks GitLab for the normalized project path", async () => {
    mockGitlabFetch
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2, visibility: "private" });

    const result = await verifyGitlabAccess({
      baseUrl: "https://gitlab.com/",
      accessToken: "token",
      tokenType: "private",
      projectPath: "/acme/web/",
    });

    expect(result.projectExists).toBe(true);
    expect(mockGitlabFetch).toHaveBeenLastCalledWith("acme/web");
  });
});
