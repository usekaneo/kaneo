import { describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      integrationTable: {
        findFirst: async () => ({
          id: "integration-1",
          projectId: "project-1",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          config: JSON.stringify({
            baseUrl: "https://gitlab.com",
            accessToken: "glpat-abcdefghijklmnop",
            projectPath: "acme/web",
            webhookSecret: "webhook-secret",
          }),
        }),
      },
    },
  },
}));

const { default: getGitlabIntegration } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/get-gitlab-integration"
);

describe("getGitlabIntegration secrets", () => {
  it("returns no token hint or webhook secret to other members", async () => {
    const integration = await getGitlabIntegration("project-1");

    expect(integration?.maskedAccessToken).toBe("");
    expect(integration?.webhookSecret).toBe("");
  });

  it("returns the token hint and webhook secret to settings managers", async () => {
    const integration = await getGitlabIntegration("project-1", true);

    expect(integration?.maskedAccessToken).toBe("glpa••••••mnop");
    expect(integration?.webhookSecret).toBe("webhook-secret");
  });
});
