import { beforeEach, expect, it, vi } from "vite-plus/test";
import { handleTaskStatusChanged as github } from "../../../../apps/api/src/plugins/github/events/task-status-changed";
import { handleTaskStatusChanged as gitea } from "../../../../apps/api/src/plugins/gitea/events/task-status-changed";
const m = vi.hoisted(() => ({ status: "", write: vi.fn(), save: vi.fn() }));
vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      taskTable: { findFirst: async () => ({ status: m.status }) },
      columnTable: { findFirst: async () => undefined },
    },
  },
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLinksByTask: async () => [
      {
        id: "link",
        taskId: "task",
        integrationId: "integration",
        resourceType: "issue",
        externalId: "1",
      },
    ],
    updateExternalLink: m.save,
  }),
);
vi.mock("../../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        update: async ({ state }: { state: string }) => ({
          data: await m.write(state),
        }),
      },
    },
  }),
}));
vi.mock("../../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    updateIssue: async (
      _owner: string,
      _repo: string,
      _number: number,
      { state }: { state: string },
    ) => m.write(state),
  }),
}));
vi.mock("../../../../apps/api/src/plugins/github/utils/labels", () => ({
  removeLabel: vi.fn(),
  addLabelsToIssue: vi.fn(),
}));
vi.mock("../../../../apps/api/src/plugins/gitea/utils/labels", () => ({
  removeLabelGitea: vi.fn(),
  addLabelsToIssueGitea: vi.fn(),
}));
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
    baseUrl: "https://gitea.example",
    accessToken: "test",
  },
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => vi.resetAllMocks());
it.each([
  ["github", "closed"],
  ["github", "open"],
  ["gitea", "closed"],
  ["gitea", "open"],
])(
  "repairs a late %s %s response using the current task state",
  async (provider, firstState) => {
    const handler = provider === "github" ? github : gitea;
    const finalState = firstState === "closed" ? "open" : "closed";
    const started = deferred();
    const release = deferred();
    let first = true;
    let remote = finalState;
    m.write.mockImplementation(async (state: string) => {
      if (first) {
        first = false;
        started.resolve();
        await release.promise;
      }
      remote = state;
      return { updated_at: `${state}-stamp` };
    });
    m.status = firstState === "closed" ? "done" : "in-progress";
    const event = {
      taskId: "task",
      projectId: "project",
      userId: "user",
      oldStatus: firstState === "closed" ? "in-progress" : "done",
      newStatus: m.status,
    };
    const older = handler(event, context);
    await started.promise;
    m.status = finalState === "closed" ? "done" : "in-progress";
    await handler(
      { ...event, oldStatus: event.newStatus, newStatus: m.status },
      context,
    );
    expect(remote).toBe(finalState);
    release.resolve();
    await older;
    expect(remote).toBe(finalState);
    expect(m.write.mock.calls.map(([state]) => state)).toEqual([
      firstState,
      finalState,
      finalState,
    ]);
    expect(m.save.mock.calls.at(-1)?.[1]).toMatchObject({
      outbound: {
        field: "state",
        value: finalState,
        updatedAt: `${finalState}-stamp`,
      },
    });
  },
);
