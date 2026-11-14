import { beforeEach, expect, it, vi } from "vite-plus/test";
import { handleTaskStatusChanged as github } from "../../../../apps/api/src/plugins/github/events/task-status-changed";
import { handleTaskStatusChanged as gitea } from "../../../../apps/api/src/plugins/gitea/events/task-status-changed";
const m = vi.hoisted(() => ({
  status: "",
  remote: "",
  getFails: false,
  write: vi.fn(),
}));
const read = (state: string) => {
  if (m.getFails) throw new Error("read failed");
  return state;
};
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
    updateExternalLink: vi.fn(),
  }),
);
vi.mock("../../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        get: async () => ({ data: { state: read(m.remote) } }),
        update: async ({ state }: { state: string }) => ({
          data: await m.write(state),
        }),
      },
    },
  }),
}));
vi.mock("../../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    getIssue: async () => ({ state: read(m.remote) }),
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
const reopen = {
  taskId: "task",
  projectId: "project",
  userId: "user",
  oldStatus: "done",
  newStatus: "in-progress",
};
it("still writes when the issue state cannot be read", async () => {
  m.remote = "closed";
  m.status = "in-progress";
  m.getFails = true;
  await github(reopen, context);
  expect(m.write.mock.calls.map(([state]) => state)).toEqual(["open"]);
});
it("does not re-close an issue closed while a reopen was in flight", async () => {
  m.remote = "closed";
  m.status = "in-progress";
  m.write.mockImplementation(async () => {
    // The reopen lands, then the issue is closed as not planned on GitHub.
    m.remote = "closed";
    m.status = "done";
    return { updated_at: "stamp" };
  });
  await github(reopen, context);
  expect(m.write.mock.calls.map(([state]) => state)).toEqual(["open"]);
});
vi.mock("../../../../apps/api/src/plugins/sync/sync-task-field-labels", () => ({
  syncTaskFieldLabels: async () => m.status,
}));
vi.mock("../../../../apps/api/src/plugins/sync/eligibility", () => ({
  canSyncTask: async () => true,
}));
vi.mock("../../../../apps/api/src/plugins/sync/dispatch-issue-write", () => ({
  dispatchIssueWrite: async (
    _link: unknown,
    _config: unknown,
    send: () => Promise<unknown>,
  ) => ({ value: await send() }),
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
beforeEach(() => {
  vi.resetAllMocks();
  m.getFails = false;
  m.write.mockImplementation(async (state: string) => {
    m.remote = state;
    return { updated_at: "stamp" };
  });
});
it.each([
  ["github", "closed", "done", "in-progress", []],
  ["github", "open", "done", "in-progress", ["closed"]],
  ["github", "open", "in-progress", "done", []],
  ["github", "closed", "in-progress", "done", ["open"]],
  ["gitea", "closed", "done", "in-progress", []],
  ["gitea", "open", "done", "in-progress", ["closed"]],
])(
  "%s issue %s, task moved to %s from %s, sends %j",
  async (provider, remote, status, oldStatus, writes) => {
    m.remote = remote;
    m.status = status;
    await (provider === "github" ? github : gitea)(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldStatus,
        newStatus: status,
      },
      context,
    );
    expect(m.write.mock.calls.map(([state]) => state)).toEqual(writes);
  },
);
