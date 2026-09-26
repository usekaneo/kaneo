import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existingIntegration: vi.fn(),
  updateSet: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      projectTable: {
        findFirst: async () => ({ id: "project-1" }),
      },
      integrationTable: {
        findFirst: () => mocks.existingIntegration(),
        findMany: async () => [],
      },
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mocks.updateSet(values);
        return {
          where: () => ({
            returning: async () => [
              {
                id: "integration-1",
                projectId: "project-1",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          }),
        };
      },
    }),
  },
}));

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  GitlabApiError: class GitlabApiError extends Error {},
  verifyGitlabToken: (...args: unknown[]) => mocks.verifyToken(...args),
  createGitlabClient: () => ({ getProject: async () => ({ id: 1 }) }),
}));

const { default: createGitlabIntegration } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/create-gitlab-integration"
);

function savedConfig() {
  const values = mocks.updateSet.mock.calls[0]?.[0] as { config: string };
  return JSON.parse(values.config);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyToken.mockResolvedValue({ id: 1 });
});

describe("createGitlabIntegration on an existing integration", () => {
  it("keeps the settings saved for the integration", async () => {
    mocks.existingIntegration.mockResolvedValue({
      id: "integration-1",
      config: JSON.stringify({
        baseUrl: "https://gitlab.com",
        accessToken: "old-token",
        tokenType: "private",
        projectPath: "acme/web",
        webhookSecret: "existing-secret",
        branchPattern: "custom",
        customBranchRegex: "^feature/(\\d+)",
        commentTaskLinkOnGitlabIssue: false,
        statusTransitions: { onPROpen: "review", onPRMerge: "shipped" },
      }),
    });

    await createGitlabIntegration({
      projectId: "project-1",
      baseUrl: "https://gitlab.com",
      accessToken: "new-token",
      tokenType: "private",
      projectPath: "acme/web",
    });

    expect(savedConfig()).toMatchObject({
      accessToken: "new-token",
      webhookSecret: "existing-secret",
      branchPattern: "custom",
      customBranchRegex: "^feature/(\\d+)",
      commentTaskLinkOnGitlabIssue: false,
      statusTransitions: { onPROpen: "review", onPRMerge: "shipped" },
    });
  });

  it("reuses the stored token and fills defaults for settings never saved", async () => {
    mocks.existingIntegration.mockResolvedValue({
      id: "integration-1",
      config: JSON.stringify({
        baseUrl: "https://gitlab.com",
        accessToken: "old-token",
        projectPath: "acme/web",
        webhookSecret: "existing-secret",
      }),
    });

    await createGitlabIntegration({
      projectId: "project-1",
      baseUrl: "https://gitlab.com",
      accessToken: undefined,
      tokenType: "private",
      projectPath: "acme/web",
    });

    expect(savedConfig()).toMatchObject({
      accessToken: "old-token",
      branchPattern: "{slug}-{number}",
      commentTaskLinkOnGitlabIssue: true,
      statusTransitions: { onPROpen: "in-review" },
    });
  });
});

describe("createGitlabIntegration input", () => {
  it("rejects a malformed project path with a 400", async () => {
    mocks.existingIntegration.mockResolvedValue(undefined);

    await expect(
      createGitlabIntegration({
        projectId: "project-1",
        baseUrl: "https://gitlab.com",
        accessToken: "token",
        tokenType: "private",
        projectPath: "acme/../web",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });
});

describe("saved GitLab credential destination", () => {
  const input = {
    projectId: "project-1",
    baseUrl: "https://gitlab.example/forge",
    accessToken: undefined,
    tokenType: "private" as const,
    projectPath: "acme/web",
  };

  beforeEach(() => {
    mocks.existingIntegration.mockResolvedValue({
      id: "integration-1",
      config: JSON.stringify({
        baseUrl: input.baseUrl,
        accessToken: "saved-secret",
        projectPath: input.projectPath,
      }),
    });
  });

  it.each([
    "https://attacker.example/forge",
    "https://gitlab.example/other",
    "https://gitlab.example:8443/forge",
  ])(
    "rejects changed destination %s before sending the saved credential",
    async (baseUrl) => {
      await expect(
        createGitlabIntegration({ ...input, baseUrl }),
      ).rejects.toMatchObject({ status: 400 });
      expect(mocks.verifyToken).not.toHaveBeenCalled();
      expect(mocks.updateSet).not.toHaveBeenCalled();
    },
  );

  it("allows normalized equivalents of the saved destination", async () => {
    await createGitlabIntegration({ ...input, baseUrl: `${input.baseUrl}/` });
    expect(mocks.verifyToken).toHaveBeenCalledWith(
      input.baseUrl,
      "saved-secret",
      "private",
    );
  });

  it("uses only the freshly supplied token for a changed destination", async () => {
    await createGitlabIntegration({
      ...input,
      baseUrl: "https://other.example",
      accessToken: "new-token",
    });
    expect(mocks.verifyToken).toHaveBeenCalledWith(
      "https://other.example",
      "new-token",
      "private",
    );
  });
});
