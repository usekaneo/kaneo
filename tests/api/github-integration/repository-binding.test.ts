import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  account: vi.fn(),
  integrations: vi.fn(),
  installation: vi.fn(),
  user: vi.fn(),
  permission: vi.fn(),
  repo: vi.fn(),
  insert: vi.fn(),
  insertReturning: vi.fn(),
  listInstallations: vi.fn(),
  listRepos: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      accountTable: { findFirst: m.account },
      projectTable: { findFirst: async () => ({ id: "project" }) },
      integrationTable: {
        findFirst: async () => null,
        findMany: m.integrations,
      },
    },
    insert: () => ({
      values: (data: unknown) => {
        m.insert(data);
        return { returning: m.insertReturning };
      },
    }),
  },
}));
// RFC 0001 WP10: the create controller enforces the repository binding quota
// before the insert; the wiring itself is covered by the plan-limits tests.
vi.mock("../../../apps/api/src/plan-limits/repository-binding-quota", () => ({
  assertRepositoryBindingQuota: vi.fn(async () => {}),
  countActiveRepositoryBindings: vi.fn(async () => 0),
  getRepositoryBindingUsage: vi.fn(async () => ({ used: 0, limit: null })),
}));
vi.mock("../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({
    octokit: {
      rest: {
        apps: {
          getRepoInstallation: m.installation,
          listInstallations: m.listInstallations,
        },
      },
    },
    getInstallationOctokit: async () => ({
      rest: {
        apps: { listReposAccessibleToInstallation: m.listRepos },
        users: { getById: m.user },
        repos: { getCollaboratorPermissionLevel: m.permission, get: m.repo },
      },
    }),
  }),
}));
const { verifyRepositoryOwner } =
  await import("../../../apps/api/src/github-integration/controllers/verify-repository-owner");
const { default: createIntegration } =
  await import("../../../apps/api/src/github-integration/controllers/create-github-integration");
const { findAllIntegrationsByRepo } =
  await import("../../../apps/api/src/plugins/github/services/task-service");
const binding = {
  repositoryOwner: "Victim",
  repositoryName: "Private",
  installationId: 10,
  repositoryId: 20,
  verifiedGithubAccountId: "30",
  verifiedByUserId: "user",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.account.mockResolvedValue({ accountId: "30" });
  m.installation.mockResolvedValue({ data: { id: 10 } });
  m.user.mockResolvedValue({ data: { id: 30, login: "verified-login" } });
  m.permission.mockResolvedValue({ data: { permission: "admin" } });
  m.repo.mockResolvedValue({
    data: { id: 20, owner: { login: "Victim" }, name: "Private" },
  });
  m.integrations.mockReset().mockResolvedValue([]);
  m.insertReturning
    .mockReset()
    .mockResolvedValue([{ id: "integration", projectId: "project" }]);
});

describe("GitHub repository linking", () => {
  it("binds the repository to the completed OAuth identity and canonical IDs", async () => {
    expect(await verifyRepositoryOwner("user", "victim", "private")).toEqual(
      binding,
    );
    expect(m.permission).toHaveBeenCalledWith({
      owner: "victim",
      repo: "private",
      username: "verified-login",
    });
  });
  it.each(["read", "write", "maintain", "none"])(
    "rejects %s permission without creating a shadow integration",
    async (permission) => {
      m.permission.mockResolvedValue({ data: { permission } });
      await expect(
        createIntegration({
          userId: "user",
          projectId: "project",
          repositoryOwner: "victim",
          repositoryName: "private",
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(m.insert).not.toHaveBeenCalled();
    },
  );
  it("rejects missing linked identity before looking up a repository", async () => {
    m.account.mockResolvedValue(null);
    await expect(
      verifyRepositoryOwner("user", "victim", "private"),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(m.installation).not.toHaveBeenCalled();
  });
  it("does not save a null installation after provider failure", async () => {
    m.installation.mockRejectedValueOnce(new Error("private provider error"));
    await expect(
      createIntegration({
        userId: "user",
        projectId: "project",
        repositoryOwner: "victim",
        repositoryName: "private",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("inserts one binding row keyed by the numeric repository id", async () => {
    await createIntegration({
      userId: "user",
      projectId: "project",
      repositoryOwner: "victim",
      repositoryName: "private",
    });
    expect(m.integrations).not.toHaveBeenCalled();
    expect(m.insert.mock.calls[0][0]).toMatchObject({
      projectId: "project",
      type: "github",
      repositoryKey: "github:20",
      repositoryOwner: "Victim",
      repositoryName: "Private",
      repositoryId: 20,
      isActive: true,
    });
    expect(JSON.parse(m.insert.mock.calls[0][0].config)).toMatchObject(binding);
  });
  it("rejects an unexpected identity response", async () => {
    m.user.mockResolvedValueOnce({ data: { id: 31, login: "somebody-else" } });
    await expect(
      verifyRepositoryOwner("user", "victim", "private"),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(m.permission).not.toHaveBeenCalled();
  });
  it("maps a same-project duplicate insert to a 409 with the documented code", async () => {
    m.insertReturning.mockRejectedValueOnce({
      code: "23505",
      constraint: "integration_project_type_repo_unique",
    });
    const error = await createIntegration({
      userId: "user",
      projectId: "project",
      repositoryOwner: "victim",
      repositoryName: "private",
    }).then(
      () => {
        throw new Error("expected the duplicate insert to be rejected");
      },
      (rejected) => rejected,
    );
    expect(error.status).toBe(409);
    expect(JSON.parse(await error.getResponse().text())).toMatchObject({
      code: "repository_already_linked",
      projectId: "project",
      type: "github",
    });
  });
  it("rethrows unique violations of other constraints unchanged", async () => {
    const otherConstraint = {
      code: "23505",
      constraint: "integration_project_type_null_repo_unique",
    };
    m.insertReturning.mockRejectedValueOnce(otherConstraint);
    const error = await createIntegration({
      userId: "user",
      projectId: "project",
      repositoryOwner: "victim",
      repositoryName: "private",
    }).then(
      () => {
        throw new Error("expected the insert failure to propagate");
      },
      (rejected) => rejected,
    );
    expect(error).toBe(otherConstraint);
  });
});

describe("GitHub webhook binding (repository_key lookup)", () => {
  const source = {
    repository: { id: 20, name: "private", owner: { login: "victim" } },
    installation: { id: 10 },
  };
  it("delivers to every verified binding of the repository through the same installation", async () => {
    const entries = [
      {
        id: "legitimate",
        config: JSON.stringify(binding),
        project: { id: "a" },
      },
      {
        // Decision D1: the same repository may be bound in several projects.
        id: "fan-out-second-project",
        config: JSON.stringify(binding),
        project: { id: "b" },
      },
      {
        id: "different-installation",
        config: JSON.stringify({ ...binding, installationId: 11 }),
        project: { id: "c" },
      },
      {
        // Unverified legacy binding: no verified account coordinates.
        id: "unverified-ids",
        config: JSON.stringify({
          repositoryOwner: "Victim",
          repositoryName: "Private",
          installationId: 10,
          repositoryId: 20,
        }),
        project: { id: "d" },
      },
      { id: "malformed", config: "invalid", project: { id: "e" } },
    ];
    m.integrations.mockResolvedValue(entries);
    expect(await findAllIntegrationsByRepo(source)).toEqual([
      entries[0],
      entries[1],
    ]);
  });
  it("falls back to the legacy owner/name key when the numeric key has no bindings", async () => {
    const legacy = { id: "legacy", config: JSON.stringify(binding) };
    m.integrations.mockResolvedValueOnce([]).mockResolvedValueOnce([legacy]);
    expect(await findAllIntegrationsByRepo(source)).toEqual([legacy]);
    expect(m.integrations).toHaveBeenCalledTimes(2);
  });
  it("skips the legacy fallback when the event lacks repository coordinates", async () => {
    m.integrations.mockResolvedValueOnce([]);
    expect(
      await findAllIntegrationsByRepo({
        repository: { id: 20 },
        installation: { id: 10 },
      }),
    ).toEqual([]);
    expect(m.integrations).toHaveBeenCalledTimes(1);
  });
  it("ignores events without an installation before querying tenant data", async () => {
    expect(await findAllIntegrationsByRepo({ repository: { id: 20 } })).toEqual(
      [],
    );
    expect(m.integrations).not.toHaveBeenCalled();
  });
});

const { default: listUserRepositories } =
  await import("../../../apps/api/src/github-integration/controllers/list-user-repositories");
const { annotateLinkedState } =
  await import("../../../apps/api/src/github-integration/controllers/annotate-linked-state");
describe("authorized bounded repository listing", () => {
  const candidate = (id: number) => ({
    id,
    name: `repo-${id}`,
    full_name: `owner/repo-${id}`,
    private: true,
    owner: { login: "owner", avatar_url: "", type: "User" },
    description: "private description",
    html_url: `https://github.com/owner/repo-${id}`,
    updated_at: "2026-01-01",
  });
  beforeEach(() => {
    m.listInstallations.mockResolvedValue({
      data: [{ id: 10, account: { login: "owner" } }],
    });
    m.listRepos.mockResolvedValue({
      data: { repositories: [candidate(20), candidate(21)] },
    });
  });
  it("returns only repositories the caller administers", async () => {
    m.permission.mockImplementation(async ({ repo }) => ({
      data: { permission: repo === "repo-20" ? "admin" : "read" },
    }));
    const page = await listUserRepositories("user", {
      installationPage: 1,
      repositoryPage: 1,
    });
    expect(page.repositories.map((repo) => repo.id)).toEqual([20]);
    expect(JSON.stringify(page)).not.toContain("repo-21");
    expect(m.listInstallations).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 1, page: 1 }),
    );
    expect(m.listRepos).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 20, page: 1 }),
    );
  });
  it("annotates each listed repository with its linked state in one query", async () => {
    m.integrations.mockResolvedValue([
      {
        id: "integration",
        projectId: "project",
        repositoryKey: "github:20",
        project: { name: "Kaneo" },
      },
    ]);
    const page = await listUserRepositories("user", {
      installationPage: 1,
      repositoryPage: 1,
    });
    const annotated = await annotateLinkedState(page.repositories);
    expect(m.integrations).toHaveBeenCalledTimes(1);
    expect(annotated[0].linkedTo).toEqual({
      integrationId: "integration",
      projectId: "project",
      projectName: "Kaneo",
    });
    expect(annotated[1].linkedTo).toBeNull();
  });
  it("does not expose an unauthorized installation's metadata", async () => {
    m.permission.mockResolvedValue({ data: { permission: "read" } });
    const page = await listUserRepositories("user", {
      installationPage: 1,
      repositoryPage: 1,
    });
    expect(page.repositories).toEqual([]);
    expect(page.installations).toEqual([]);
    expect(JSON.stringify(page)).not.toContain("owner");
  });
  it("does not traverse additional pages in the same request", async () => {
    m.listRepos.mockResolvedValue({
      data: {
        repositories: Array.from({ length: 20 }, (_, i) => candidate(i + 1)),
      },
    });
    const page = await listUserRepositories("user", {
      installationPage: 2,
      repositoryPage: 3,
    });
    expect(m.listInstallations).toHaveBeenCalledTimes(1);
    expect(m.listRepos).toHaveBeenCalledTimes(1);
    expect(m.permission).toHaveBeenCalledTimes(20);
    expect(page.nextPage).toEqual({ installationPage: 2, repositoryPage: 4 });
  });
  it("stops when all installations have been visited", async () => {
    m.listInstallations.mockResolvedValue({ data: [] });
    const page = await listUserRepositories("user", {
      installationPage: 3,
      repositoryPage: 1,
    });
    expect(page.nextPage).toBeNull();
    expect(m.listRepos).not.toHaveBeenCalled();
  });
  it("searches before checking access and keeps scanning installations", async () => {
    m.listInstallations
      .mockResolvedValueOnce({
        data: [{ id: 10, account: { login: "owner" } }],
      })
      .mockResolvedValueOnce({ data: [{ id: 11, account: { login: "org" } }] })
      .mockResolvedValueOnce({ data: [] });
    m.listRepos
      .mockResolvedValueOnce({
        data: {
          repositories: [
            { ...candidate(20), full_name: "owner/website" },
            { ...candidate(21), description: null },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: { repositories: [{ ...candidate(30), full_name: "org/web" }] },
      });
    const page = await listUserRepositories(
      "user",
      { installationPage: 1, repositoryPage: 1 },
      "WEB",
    );
    expect(page.repositories.map((repo) => repo.id)).toEqual([20, 30]);
    expect(page.installations.map((item) => item.id)).toEqual([10, 11]);
    expect(page.nextPage).toBeNull();
    expect(m.listRepos).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 100, page: 1 }),
    );
    expect(m.user).toHaveBeenCalledTimes(2);
    expect(m.permission).toHaveBeenCalledTimes(2);
    expect(m.permission).not.toHaveBeenCalledWith(
      expect.objectContaining({ repo: "repo-21" }),
    );
  });
  it("does not return search matches the caller cannot administer", async () => {
    m.listInstallations
      .mockResolvedValueOnce({
        data: [{ id: 10, account: { login: "owner" } }],
      })
      .mockResolvedValueOnce({ data: [] });
    m.permission.mockResolvedValue({ data: { permission: "write" } });
    const page = await listUserRepositories(
      "user",
      { installationPage: 1, repositoryPage: 1 },
      "private",
    );
    expect(page.repositories).toEqual([]);
    expect(page.installations).toEqual([]);
    expect(JSON.stringify(page)).not.toContain("owner");
  });
  it("rejects unlinked callers before any provider enumeration", async () => {
    m.account.mockResolvedValue(null);
    await expect(
      listUserRepositories("user", { installationPage: 1, repositoryPage: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    expect(m.listInstallations).not.toHaveBeenCalled();
  });
});
