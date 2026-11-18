import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  existingIntegration: vi.fn(),
  verifyToken: vi.fn(),
  insertValues: vi.fn(),
}));

// RFC 0001 WP4/WP10: the create controller links a fresh binding row instead
// of mutating an existing one, and it enforces the repository binding quota
// and inserts inside the project's advisory-lock transaction on the
// transaction handle. The stub mirrors that: db.transaction passes the same
// handle through, and the quota's select stage machine answers first with
// "no row" (workspace override) and then with a zero count, so the quota is
// effectively unlimited in these tests. A saved credential authorizes reuse
// only for the destination it belongs to; per-binding settings are not
// carried over to the new row.
vi.mock("../../../apps/api/src/database", () => {
  const handle = {
    query: {
      projectTable: {
        findFirst: async () => ({
          id: "project-1",
          workspaceId: "workspace-1",
        }),
      },
      integrationTable: {
        findFirst: () => mocks.existingIntegration(),
        findMany: async () => {
          const row = await mocks.existingIntegration();
          return row ? [row] : [];
        },
      },
    },
    select: (() => {
      let stage: "limit" | "count" = "limit";
      return () =>
        stage === "limit"
          ? {
              from: () => ({
                where: () => ({
                  limit: async () => {
                    stage = "count";
                    return [];
                  },
                }),
              }),
            }
          : { from: () => ({ where: async () => [{ count: 0 }] }) };
    })(),
    insert: () => ({
      values: (data: Record<string, unknown>) => {
        mocks.insertValues(data);
        return {
          returning: async () => [
            {
              id: "integration-2",
              projectId: "project-1",
              isActive: true,
              createdAt: new Date("2026-01-01T00:00:00Z"),
              updatedAt: new Date("2026-01-01T00:00:00Z"),
            },
          ],
        };
      },
    }),
  };
  handle.transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(handle);
  return { default: handle };
});

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  GitlabApiError: class GitlabApiError extends Error {},
  verifyGitlabToken: (...args: unknown[]) => mocks.verifyToken(...args),
  createGitlabClient: () => ({ getProject: async () => ({ id: 1 }) }),
}));

const { default: createGitlabIntegration } =
  await import("../../../apps/api/src/gitlab-integration/controllers/create-gitlab-integration");

function insertedConfig() {
  const values = mocks.insertValues.mock.calls[0]?.[0] as { config: string };
  return JSON.parse(values.config);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyToken.mockResolvedValue({ id: 1 });
});

describe("createGitlabIntegration with a saved credential", () => {
  const savedConfig = {
    baseUrl: "https://gitlab.com",
    accessToken: "old-token",
    tokenType: "private",
    projectPath: "acme/web",
    webhookSecret: "existing-secret",
    branchPattern: "custom",
    customBranchRegex: "^feature/(\\d+)",
    commentTaskLinkOnGitlabIssue: false,
    statusTransitions: { onPROpen: "review", onPRMerge: "shipped" },
  };

  beforeEach(() => {
    mocks.existingIntegration.mockResolvedValue({
      id: "integration-1",
      config: JSON.stringify(savedConfig),
    });
  });

  it("reuses the stored token for a matching destination", async () => {
    await createGitlabIntegration({
      projectId: "project-1",
      baseUrl: "https://gitlab.com",
      accessToken: undefined,
      tokenType: "private",
      projectPath: "acme/web",
    });

    expect(mocks.verifyToken).toHaveBeenCalledWith(
      "https://gitlab.com",
      "old-token",
      "private",
    );
    expect(insertedConfig()).toMatchObject({
      accessToken: "old-token",
    });
  });

  it("links a fresh binding with default settings and a new secret", async () => {
    await createGitlabIntegration({
      projectId: "project-1",
      baseUrl: "https://gitlab.com",
      accessToken: "new-token",
      tokenType: "private",
      projectPath: "acme/web",
    });

    // WP4: settings belong to their own binding; the new row starts from
    // the defaults with its own webhook secret, never the saved one.
    expect(insertedConfig()).toMatchObject({
      accessToken: "new-token",
      branchPattern: "{slug}-{number}",
      commentTaskLinkOnGitlabIssue: true,
      statusTransitions: { onPROpen: "in-review" },
    });
    expect(insertedConfig().webhookSecret).not.toBe("existing-secret");
  });

  it("keys the new binding row by base URL and lowercased project path", async () => {
    await createGitlabIntegration({
      projectId: "project-1",
      baseUrl: "https://gitlab.com",
      accessToken: "new-token",
      tokenType: "private",
      projectPath: "Acme/Web",
    });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        type: "gitlab",
        repositoryKey: "gitlab:https://gitlab.com/acme/web",
        isActive: true,
      }),
    );
  });
});

describe("createGitlabIntegration input", () => {
  it("rejects a malformed project path with a 400", async () => {
    await expect(
      createGitlabIntegration({
        projectId: "project-1",
        baseUrl: "https://gitlab.com",
        accessToken: "token",
        tokenType: "private",
        projectPath: "acme/../web",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.insertValues).not.toHaveBeenCalled();
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
      ).rejects.toMatchObject({
        status: 400,
      });
      expect(mocks.verifyToken).not.toHaveBeenCalled();
      expect(mocks.insertValues).not.toHaveBeenCalled();
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
