import { outboundStamp } from "../../../../apps/api/src/plugins/github/utils/sync-echo";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { handleGiteaIssueEdited } from "../../../../apps/api/src/plugins/gitea/webhooks/issue-edited";
const m = vi.hoisted(() => ({
  metadata: "",
  lockedMetadata: undefined as string | undefined,
  getIssue: vi.fn(),
  status: vi.fn(),
  writes: vi.fn(),
  linkWrites: vi.fn(),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      columnTable: { findFirst: async () => undefined },
      externalLinkTable: {
        findFirst: async () => ({
          id: "link",
          taskId: "task",
          metadata: m.metadata,
        }),
      },
      taskTable: {
        findFirst: async () => ({ id: "task", projectId: "project" }),
      },
    },
    update: () => ({
      set: m.writes.mockReturnValue({ where: async () => undefined }),
    }),
  },
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/integration-task-scope",
  async (original) => ({
    ...(await original<
      typeof import("../../../../apps/api/src/plugins/github/services/integration-task-scope")
    >()),
    withIntegrationTask: async (
      _id: string,
      _scope: unknown,
      apply: (database: unknown) => Promise<unknown>,
    ) => apply((await import("../../../../apps/api/src/database")).default),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLink: async () => ({
      id: "link",
      taskId: "task",
      metadata: m.metadata,
    }),
    updateExternalLink: m.linkWrites,
    lockExternalLink: async () => ({
      id: "link",
      metadata: m.lockedMetadata ?? m.metadata,
    }),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitea/services/integration-lookup",
  () => ({
    findAllIntegrationsByGiteaRepo: async () => [
      {
        id: "integration",
        projectId: "project",
        config: JSON.stringify({
          baseUrl: "https://gitea.example",
          accessToken: "test",
          repositoryOwner: "owner",
          repositoryName: "repo",
        }),
      },
    ],
    repoOwnerLogin: () => "owner",
  }),
);
vi.mock("../../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({ getIssue: m.getIssue }),
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/with-integration-link",
  () => ({
    withIntegrationLink: async (
      _link: unknown,
      _scope: unknown,
      apply: (
        database: unknown,
        afterCommit: unknown,
        link: unknown,
      ) => Promise<unknown>,
    ) =>
      apply(
        (await import("../../../../apps/api/src/database")).default,
        () => {},
        {
          id: "link",
          taskId: "task",
          metadata: m.lockedMetadata ?? m.metadata,
        },
      ),
  }),
);
const payload = {
  action: "edited",
  repository: {
    owner: { login: "owner" },
    name: "repo",
    html_url: "https://gitea.example/owner/repo",
  },
  issue: {
    number: 1,
    title: "Remote correction",
    body: "Remote description",
    html_url: "https://gitea.example/owner/repo/issues/1",
  },
  changes: { title: { from: "Old" }, body: { from: "Old body" } },
};
beforeEach(() => {
  vi.clearAllMocks();
  m.lockedMetadata = undefined;
  m.getIssue.mockResolvedValue({ title: "Newest title", body: "Newest body" });
  m.metadata = JSON.stringify({
    lastSync: {
      title: {
        source: "kaneo",
        value: "Local title",
        timestamp: new Date().toISOString(),
      },
      description: {
        source: "kaneo",
        value: "Local description",
        timestamp: new Date().toISOString(),
      },
    },
  });
});
describe("rapid gitea text edits", () => {
  it("applies a different title and description immediately after an outbound sync", async () => {
    await handleGiteaIssueEdited(payload);
    expect(m.writes).toHaveBeenCalledWith({
      title: "Remote correction",
      description: "Remote description",
    });
  });
  it("still ignores exact title and description echoes", async () => {
    await handleGiteaIssueEdited({
      ...payload,
      issue: {
        ...payload.issue,
        title: "Local title",
        body: "Local description",
      },
    });
    expect(m.writes).not.toHaveBeenCalled();
  });
});

it("ignores a delayed first echo after a newer outbound edit", async () => {
  m.metadata = JSON.stringify({
    lastSync: {
      title: outboundStamp(
        outboundStamp(undefined, "Earlier title", "2026-01-01T00:00:00Z"),
        "Newest title",
        "2026-01-01T00:00:01Z",
      ),
      description: outboundStamp(
        outboundStamp(undefined, "Earlier body", "2026-01-01T00:00:00Z"),
        "Newest body",
        "2026-01-01T00:00:01Z",
      ),
    },
  });
  await handleGiteaIssueEdited({
    ...payload,
    issue: {
      ...payload.issue,
      title: "Earlier title",
      body: "Earlier body",
      updated_at: "2026-01-01T00:00:00Z",
    },
  });
  expect(m.writes).not.toHaveBeenCalled();
});
it("allows a new remote edit back to an older outbound value", async () => {
  m.metadata = JSON.stringify({
    lastSync: {
      title: outboundStamp(
        outboundStamp(undefined, "Earlier title", "2026-01-01T00:00:00Z"),
        "Newest title",
        "2026-01-01T00:00:01Z",
      ),
    },
  });
  await handleGiteaIssueEdited({
    ...payload,
    changes: { title: { from: "Newest title" } },
    issue: {
      ...payload.issue,
      title: "Earlier title",
      updated_at: "2026-01-01T00:00:02Z",
    },
  });
  expect(m.writes).toHaveBeenCalledWith({ title: "Earlier title" });
});

vi.mock(
  "../../../../apps/api/src/plugins/github/services/task-service",
  async (original) => ({
    ...(await original<
      typeof import("../../../../apps/api/src/plugins/github/services/task-service")
    >()),
    updateTaskStatus: m.status,
  }),
);
vi.mock("../../../../apps/api/src/plugins/gitea/utils/resolve-column", () => ({
  resolveTargetStatus: async (
    _project: string,
    _event: string,
    fallback: string,
  ) => fallback,
}));
it("ignores an older close echo after a newer outbound reopen", async () => {
  const { handleGiteaIssueClosed } =
    await import("../../../../apps/api/src/plugins/gitea/webhooks/issue-closed");
  m.metadata = JSON.stringify({
    state: "open",
    lastSync: {
      state: outboundStamp(
        outboundStamp(undefined, "closed", "2026-01-01T00:00:00Z"),
        "open",
        "2026-01-01T00:00:01Z",
      ),
    },
  });
  m.getIssue.mockResolvedValue({ state: "open" });
  await handleGiteaIssueClosed({
    ...payload,
    action: "closed",
    issue: {
      ...payload.issue,
      state: "closed",
      updated_at: "2026-01-01T00:00:00Z",
    },
  });
  expect(m.status).not.toHaveBeenCalled();
});
it("ignores an older reopen echo after a newer outbound close", async () => {
  const { handleGiteaIssueReopened } =
    await import("../../../../apps/api/src/plugins/gitea/webhooks/issue-reopened");
  m.metadata = JSON.stringify({
    state: "closed",
    lastSync: {
      state: outboundStamp(
        outboundStamp(undefined, "open", "2026-01-01T00:00:00Z"),
        "closed",
        "2026-01-01T00:00:01Z",
      ),
    },
  });
  m.getIssue.mockResolvedValue({ state: "closed" });
  await handleGiteaIssueReopened({
    ...payload,
    action: "reopened",
    issue: {
      ...payload.issue,
      state: "open",
      updated_at: "2026-01-01T00:00:00Z",
    },
  });
  expect(m.status).not.toHaveBeenCalled();
});

it("accepts a legitimate remote edit matching a historical outbound value within the same timestamp", async () => {
  const stamp = "2026-01-01T00:00:00Z";
  m.metadata = JSON.stringify({
    lastSync: {
      title: outboundStamp(
        outboundStamp(undefined, "Earlier title", stamp),
        "Newest title",
        stamp,
      ),
      description: outboundStamp(
        outboundStamp(undefined, "Earlier body", stamp),
        "Newest body",
        stamp,
      ),
    },
  });
  m.getIssue.mockResolvedValue({
    title: "Earlier title",
    body: "Earlier body",
  });
  await handleGiteaIssueEdited({
    ...payload,
    issue: {
      ...payload.issue,
      title: "Earlier title",
      body: "Earlier body",
      updated_at: stamp,
    },
  });
  expect(m.writes).toHaveBeenCalledWith({
    title: "Earlier title",
    description: "Earlier body",
  });
  // Each ambiguous field needs a confirmation tied to its locked sync state.
  expect(m.getIssue).toHaveBeenCalledTimes(2);
});

it("ignores the linked task footer when detecting a description echo", async () => {
  await handleGiteaIssueEdited({
    ...payload,
    changes: { body: { from: "Old" } },
    issue: {
      ...payload.issue,
      body: "Local description\n\n---\n<sub>Task: task</sub>",
    },
  });
  expect(m.writes).not.toHaveBeenCalled();
});
it("accepts a same-timestamp remote close matching historical outbound state", async () => {
  const { handleGiteaIssueClosed } =
    await import("../../../../apps/api/src/plugins/gitea/webhooks/issue-closed");
  const stamp = "2026-01-01T00:00:00Z";
  m.metadata = JSON.stringify({
    state: "open",
    lastSync: {
      state: outboundStamp(
        outboundStamp(undefined, "closed", stamp),
        "open",
        stamp,
      ),
    },
  });
  m.getIssue.mockResolvedValue({ state: "closed" });
  m.status.mockResolvedValue({ applied: false });
  await handleGiteaIssueClosed({
    ...payload,
    action: "closed",
    issue: { ...payload.issue, state: "closed", updated_at: stamp },
  });
  expect(m.status).toHaveBeenCalled();
});

it("retains outbound stamps added after the initial inbound snapshot", async () => {
  m.metadata = JSON.stringify({ lastSync: {} });
  const stamp = outboundStamp(undefined, "New local title", "new-time");
  m.lockedMetadata = JSON.stringify({
    marker: "preserve",
    lastSync: { title: stamp },
  });
  await handleGiteaIssueEdited(payload);
  expect(
    m.linkWrites.mock.calls[0][1].metadata.lastSync.title.outbound,
  ).toEqual(stamp.outbound);
  expect(m.linkWrites.mock.calls[0][1].metadata.marker).toBe("preserve");
});

it("recognizes a delayed echo whose stamp arrives before the locked reread", async () => {
  m.metadata = JSON.stringify({ lastSync: {} });
  m.lockedMetadata = JSON.stringify({
    lastSync: {
      title: outboundStamp(undefined, payload.issue.title, undefined),
    },
  });
  await handleGiteaIssueEdited({
    ...payload,
    changes: { title: payload.changes.title },
  });
  expect(m.writes).not.toHaveBeenCalled();
});

it("applies an ordinary complete webhook without consulting an unavailable provider", async () => {
  m.metadata = JSON.stringify({ lastSync: {} });
  m.getIssue.mockRejectedValue(new Error("provider unavailable"));
  await handleGiteaIssueEdited(payload);
  expect(m.getIssue).not.toHaveBeenCalled();
  expect(m.writes).toHaveBeenCalledWith(
    expect.objectContaining({
      title: payload.issue.title,
      description: payload.issue.body,
    }),
  );
});

it("rechecks a close echo from the locked state snapshot", async () => {
  m.metadata = JSON.stringify({ lastSync: {} });
  m.lockedMetadata = JSON.stringify({
    lastSync: { state: outboundStamp(undefined, "closed") },
  });
  const { handleGiteaIssueClosed } =
    await import("../../../../apps/api/src/plugins/gitea/webhooks/issue-closed");
  await handleGiteaIssueClosed({
    action: "closed",
    repository: payload.repository,
    issue: { ...payload.issue, state: "closed" },
  });
  expect(m.status).not.toHaveBeenCalled();
});

it("applies a close following an inbound reopen within the same provider timestamp", async () => {
  const { handleGiteaIssueClosed } =
    await import("../../../../apps/api/src/plugins/gitea/webhooks/issue-closed");
  const { handleGiteaIssueReopened } =
    await import("../../../../apps/api/src/plugins/gitea/webhooks/issue-reopened");
  const stamp = "2026-01-01T00:00:00Z";
  m.metadata = JSON.stringify({
    state: "closed",
    lastSync: { state: outboundStamp(undefined, "closed", stamp) },
  });
  m.status.mockResolvedValue({ applied: false });
  m.linkWrites.mockImplementation(async (_id, update) => {
    m.metadata = JSON.stringify(update.metadata);
  });
  await handleGiteaIssueReopened({
    ...payload,
    action: "reopened",
    issue: { ...payload.issue, state: "open", updated_at: stamp },
  });
  expect(JSON.parse(m.metadata).lastSync.state.value).toBe("open");
  m.getIssue.mockResolvedValue({ state: "closed" });
  await handleGiteaIssueClosed({
    ...payload,
    action: "closed",
    issue: { ...payload.issue, state: "closed", updated_at: stamp },
  });
  expect(m.status).toHaveBeenCalledTimes(2);
  expect(JSON.parse(m.metadata).state).toBe("closed");
});
