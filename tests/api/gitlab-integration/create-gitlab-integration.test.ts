import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  existingIntegration: vi.fn(),
  verifyToken: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
}));

// RFC 0001 WP4/WP10: the create controller enforces the repository binding
// quota and writes inside the project's advisory-lock transaction on the
// transaction handle. The stub mirrors that: db.transaction passes the same
// handle through, and the quota's select stub answers both chain shapes
// with "no row" (workspace override) and a zero count, so the quota is
// effectively unlimited in these tests. A saved credential authorizes reuse
// only for the destination it belongs to. Re-linking the destination an
// existing same-project binding already owns reconciles that row in place:
// the verified token and destination win, prior per-binding settings and
// the webhook secret survive the merge, and no second row is inserted.
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
    // The quota helpers chain the same builder two ways:
    //   resolveRepositoryBindingLimits -> select().from().where().limit()
    //   countActiveRepositoryBindings  -> select().from().where() (awaited)
    // The where() stub returns a real Promise (awaitable, resolving to the
    // count rows) with an attached limit() method (chainable), so any call
    // order and any repetition works and the quota stays effectively
    // unlimited in these tests. A then property literal is avoided on
    // purpose: unicorn/no-thenable forbids thenable-looking objects.
    select: () => ({
      from: () => ({
        where: () => {
          const whereResult = Promise.resolve([{ count: 0 }]) as Promise<
            { count: number }[]
          > & { limit: () => Promise<never[]> };
          Object.assign(whereResult, { limit: async () => [] });
          return whereResult;
        },
      }),
    }),
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
    // The reconcile-in-place branch writes through update().set(); the
    // returning row models the snapshotted row after the guarded update.
    update: () => ({
      set: (data: Record<string, unknown>) => {
        mocks.updateSet(data);
        return {
          where: () => ({
            returning: async () => [
              {
                id: "integration-1",
                projectId: "project-1",
                isActive: true,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                updatedAt: new Date("2026-01-01T00:00:00Z"),
              },
            ],
          }),
        };
      },
    }),
    // tx.execute runs the pg_advisory_xact_lock statement; a no-op result is
    // enough because the stub transaction never commits or rolls back.
    execute: async () => ({ rows: [] }),
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

function updatedSet() {
  return mocks.updateSet.mock.calls[0]?.[0] as Record<string, unknown>;
}

function updatedConfig() {
  return JSON.parse(updatedSet().config as string);
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
    // The same destination reconciles the snapshotted row in place; no
    // second binding row is inserted for it.
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(updatedSet()).toMatchObject({
      repositoryKey: "gitlab:https://gitlab.com/acme/web",
      baseUrl: "https://gitlab.com",
    });
    expect(updatedConfig()).toMatchObject({
      accessToken: "old-token",
      webhookSecret: "existing-secret",
    });
  });

  it("re-links the saved binding in place without resetting its settings", async () => {
    await createGitlabIntegration({
      projectId: "project-1",
      baseUrl: "https://gitlab.com",
      accessToken: "new-token",
      tokenType: "private",
      projectPath: "acme/web",
    });

    // The freshly verified token wins over the stored one, while the
    // per-binding settings and the webhook secret survive the merge.
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(updatedConfig()).toMatchObject({
      accessToken: "new-token",
      branchPattern: "custom",
      commentTaskLinkOnGitlabIssue: false,
      statusTransitions: { onPROpen: "review", onPRMerge: "shipped" },
      webhookSecret: "existing-secret",
    });
  });

  it("re-keys the reconciled row by base URL and lowercased project path", async () => {
    await createGitlabIntegration({
      projectId: "project-1",
      baseUrl: "https://gitlab.com",
      accessToken: "new-token",
      tokenType: "private",
      projectPath: "Acme/Web",
    });

    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
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
    // A changed destination owns no same-project binding, so it links a
    // fresh row instead of reconciling one.
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        type: "gitlab",
        repositoryKey: "gitlab:https://other.example/acme/web",
        isActive: true,
      }),
    );
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });
});
