import { outboundStamp } from "../../../../apps/api/src/plugins/github/utils/sync-echo";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { handleGiteaIssueEdited } from "../../../../apps/api/src/plugins/gitea/webhooks/issue-edited";
const m = vi.hoisted(() => ({
  metadata: "",
  getIssue: vi.fn(),
  status: vi.fn(),
  writes: vi.fn(),
  linkWrites: vi.fn(),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
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
  () => ({ updateTaskStatus: m.status }),
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
  expect(m.getIssue).toHaveBeenCalledTimes(1);
});
