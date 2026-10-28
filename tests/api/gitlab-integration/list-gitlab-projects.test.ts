import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  verifyGitlabToken: () => Promise.reject(new Error("GitLab API error 401")),
  createGitlabClient: () => ({ listMemberProjects: () => Promise.resolve([]) }),
}));

const { default: listGitlabProjects } =
  await import("../../../apps/api/src/gitlab-integration/controllers/list-gitlab-projects");

describe("listGitlabProjects", () => {
  it("reports a rejected GitLab token as an integration auth failure", async () => {
    await expect(
      listGitlabProjects({
        baseUrl: "https://gitlab.com",
        accessToken: "token",
        tokenType: "private",
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "INTEGRATION_AUTH_FAILED",
    });
  });
});
