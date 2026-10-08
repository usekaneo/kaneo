import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  current: { title: "", description: "" },
  links: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({ findExternalLinksByTask: m.links, updateExternalLink: m.save }),
);
vi.mock("../../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: { issues: { update: m.update } },
  }),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: { query: { taskTable: { findFirst: async () => m.current } } },
}));
const { handleTaskTitleChanged } =
  await import("../../../../apps/api/src/plugins/github/events/task-title-changed");
const { handleTaskDescriptionChanged } =
  await import("../../../../apps/api/src/plugins/github/events/task-description-changed");
const context = {
  integrationId: "integration",
  projectId: "project",
  config: {
    repositoryOwner: "owner",
    repositoryName: "repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: "user",
  },
};
beforeEach(() => vi.resetAllMocks());
function link(field: string, source: string, value: string) {
  return {
    id: "link",
    integrationId: "integration",
    taskId: "task",
    resourceType: "issue",
    externalId: "1",
    metadata: JSON.stringify({
      lastSync: {
        [field]: { source, value, timestamp: new Date().toISOString() },
      },
    }),
  };
}
describe("rapid github text edits", () => {
  it("sends a second local title even immediately after the first sync", async () => {
    m.current.title = "Second title";
    m.links.mockResolvedValue([link("title", "kaneo", "First title")]);
    await handleTaskTitleChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldTitle: "First title",
        newTitle: "Second title",
      },
      context,
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Second title" }),
    );
  });
  it("sends a different title immediately after an incoming github title", async () => {
    m.current.title = "Local correction";
    m.links.mockResolvedValue([link("title", "github", "Remote title")]);
    await handleTaskTitleChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldTitle: "Remote title",
        newTitle: "Local correction",
      },
      context,
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Local correction" }),
    );
  });
  it("keeps suppressing an exact incoming echo", async () => {
    m.current.title = "Remote title";
    m.links.mockResolvedValue([link("title", "github", "Remote title")]);
    await handleTaskTitleChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldTitle: "Old",
        newTitle: "Remote title",
      },
      context,
    );
    expect(m.update).not.toHaveBeenCalled();
  });
  it("sends a second local description immediately after the first sync", async () => {
    m.current.description = "Second description";
    m.links.mockResolvedValue([
      link("description", "kaneo", "First description"),
    ]);
    await handleTaskDescriptionChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldDescription: "First description",
        newDescription: "Second description",
      },
      context,
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Second description"),
      }),
    );
  });
});

it("does not send a queued title after a newer task edit", async () => {
  m.current.title = "Newest";
  m.links.mockResolvedValue([link("title", "kaneo", "Old")]);
  await handleTaskTitleChanged(
    {
      taskId: "task",
      projectId: "project",
      userId: "user",
      oldTitle: "Old",
      newTitle: "Queued",
    },
    context,
  );
  expect(m.update).not.toHaveBeenCalled();
});

vi.mock("../../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    updateIssue: async (
      _owner: string,
      _repo: string,
      _number: number,
      input: unknown,
    ) => m.update(input),
  }),
}));
const giteaTitle = (
  await import("../../../../apps/api/src/plugins/gitea/events/task-title-changed")
).handleTaskTitleChanged;
const giteaDescription = (
  await import("../../../../apps/api/src/plugins/gitea/events/task-description-changed")
).handleTaskDescriptionChanged;
it.each([
  ["github", "title"],
  ["github", "description"],
  ["gitea", "title"],
  ["gitea", "description"],
])(
  "repairs %s %s when an older request completes after the latest edit",
  async (provider, field) => {
    let finishOld!: () => void;
    let oldStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      oldStarted = resolve;
    });
    const delayed = new Promise<void>((resolve) => {
      finishOld = resolve;
    });
    let remote = "";
    m.current.title = "A";
    m.current.description = "A";
    m.links.mockResolvedValue([link(field, "kaneo", "Before")]);
    m.update.mockImplementation(async (input) => {
      const value =
        field === "title" ? input.title : input.body.split("\n\n---")[0];
      if (value === "A") {
        oldStarted();
        await delayed;
      }
      remote = value;
      return {
        updated_at: "provider-time",
        data: { updated_at: "provider-time" },
      };
    });
    const handler =
      provider === "github"
        ? field === "title"
          ? handleTaskTitleChanged
          : handleTaskDescriptionChanged
        : field === "title"
          ? giteaTitle
          : giteaDescription;
    const config =
      provider === "github"
        ? context
        : {
            ...context,
            config: {
              ...context.config,
              baseUrl: "https://gitea.example",
              accessToken: "test",
            },
          };
    function event(value: string) {
      return {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldTitle: "Before",
        newTitle: value,
        oldDescription: "Before",
        newDescription: value,
      };
    }
    const first = handler(event("A"), config);
    await started;
    m.current.title = "B";
    m.current.description = "B";
    await handler(event("B"), config);
    expect(remote).toBe("B");
    finishOld();
    await first;
    expect(remote).toBe("B");
    expect(m.update).toHaveBeenCalledTimes(3);
    expect(m.save.mock.calls.at(-1)?.[1].outbound.value).toBe("B");
  },
);

// Policy enforcement is covered by the PostgreSQL sync-rules integration tests.
vi.mock("../../../../apps/api/src/plugins/sync/eligibility", () => ({
  canSyncTask: async () => true,
}));

vi.mock("../../../../apps/api/src/plugins/sync/dispatch-issue-write", () => ({
  createIssueWrite: () => (send: () => Promise<unknown>) => send(),
  dispatchIssueWrite: async (
    _link: unknown,
    _config: unknown,
    send: () => Promise<unknown>,
  ) => ({ value: await send() }),
}));
