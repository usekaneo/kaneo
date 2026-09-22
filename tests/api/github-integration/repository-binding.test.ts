import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  account: vi.fn(),
  integrations: vi.fn(),
  installation: vi.fn(),
  user: vi.fn(),
  permission: vi.fn(),
  repo: vi.fn(),
  insert: vi.fn(),
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
        return {
          returning: async () => [{ id: "integration", projectId: "project" }],
        };
      },
    }),
  },
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
const { verifyRepositoryOwner } = await import(
  "../../../apps/api/src/github-integration/controllers/verify-repository-owner"
);
const { default: createIntegration } = await import(
  "../../../apps/api/src/github-integration/controllers/create-github-integration"
);
const { findAllIntegrationsByRepo } = await import(
  "../../../apps/api/src/plugins/github/services/task-service"
);
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
    ).rejects.toMatchObject({ status: 403 });
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
  it("does not consult another tenant's integrations when linking", async () => {
    await createIntegration({
      userId: "user",
      projectId: "project",
      repositoryOwner: "victim",
      repositoryName: "private",
    });
    expect(m.integrations).not.toHaveBeenCalled();
    expect(JSON.parse(m.insert.mock.calls[0][0].config)).toMatchObject(binding);
  });
  it("rejects an unexpected identity response", async () => {
    m.user.mockResolvedValueOnce({ data: { id: 31, login: "somebody-else" } });
    await expect(
      verifyRepositoryOwner("user", "victim", "private"),
    ).rejects.toMatchObject({ status: 403 });
    expect(m.permission).not.toHaveBeenCalled();
  });
});

describe("GitHub webhook binding", () => {
  const source = { repository: { id: 20 }, installation: { id: 10 } };
  it("delivers only to verified bindings for both immutable identifiers", async () => {
    const entries = [
      { id: "legitimate", config: JSON.stringify(binding) },
      {
        id: "different-installation",
        config: JSON.stringify({ ...binding, installationId: 11 }),
      },
      {
        id: "same-name-different-repo",
        config: JSON.stringify({ ...binding, repositoryId: 21 }),
      },
      {
        id: "legacy-name-only",
        config: JSON.stringify({
          repositoryOwner: "Victim",
          repositoryName: "Private",
          installationId: 10,
        }),
      },
      {
        id: "unverified-ids",
        config: JSON.stringify({
          repositoryOwner: "Victim",
          repositoryName: "Private",
          installationId: 10,
          repositoryId: 20,
        }),
      },
      { id: "malformed", config: "invalid" },
    ];
    m.integrations.mockResolvedValue(entries);
    expect(await findAllIntegrationsByRepo(source)).toEqual([entries[0]]);
  });
  it("ignores events without an installation before querying tenant data", async () => {
    expect(await findAllIntegrationsByRepo({ repository: { id: 20 } })).toEqual(
      [],
    );
    expect(m.integrations).not.toHaveBeenCalled();
  });
});

const { default: listUserRepositories } = await import(
  "../../../apps/api/src/github-integration/controllers/list-user-repositories"
);
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
  it("rejects unlinked callers before any provider enumeration", async () => {
    m.account.mockResolvedValue(null);
    await expect(
      listUserRepositories("user", { installationPage: 1, repositoryPage: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    expect(m.listInstallations).not.toHaveBeenCalled();
  });
});
