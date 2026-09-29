import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { handleGiteaIssueEdited } from "../../../../apps/api/src/plugins/gitea/webhooks/issue-edited";
const m = vi.hoisted(() => ({
  metadata: "",
  writes: vi.fn(),
  linkWrites: vi.fn(),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
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
      { id: "integration", projectId: "project" },
    ],
    repoOwnerLogin: () => "owner",
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
