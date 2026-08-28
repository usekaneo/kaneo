import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  externalLinkFindFirst: vi.fn(),
  taskFindFirst: vi.fn(),
  updateExternalLink: vi.fn(),
  updateTaskStatus: vi.fn(),
  resolveTargetStatus: vi.fn(),
  publishEvent: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: {
        findFirst: (...a: unknown[]) => mocks.externalLinkFindFirst(...a),
      },
      taskTable: { findFirst: (...a: unknown[]) => mocks.taskFindFirst(...a) },
    },
  },
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    updateExternalLink: (...a: unknown[]) => mocks.updateExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

const { handleGitlabIssueClosed, handleGitlabIssueReopened } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-state-changed"
);

const NOW = 1_700_000_000_000;

function payload(action: "close" | "reopen", updatedAt: number) {
  return {
    object_kind: "issue",
    object_attributes: {
      iid: 42,
      title: "Login button is inert",
      description: null,
      url: "https://gitlab.example/acme/my-app/-/issues/42",
      state: action === "close" ? "closed" : "opened",
      action,
      updated_at: new Date(updatedAt).toISOString(),
    },
    project: {
      web_url: "https://gitlab.example/acme/my-app",
      path_with_namespace: "acme/my-app",
    },
  };
}

function linkWithOutbound(state: "closed" | "opened", at: number) {
  return {
    id: "link-1",
    taskId: "task-1",
    metadata: JSON.stringify({
      state,
      lastOutboundState: state,
      lastOutboundStateSyncAt: at,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([
    { id: "integration-1", projectId: "project-1" },
  ]);
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-1",
    projectId: "project-1",
  });
  mocks.resolveTargetStatus.mockImplementation(
    async (_p: string, _e: string, fallback: string) => fallback,
  );
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "done" },
    after: {
      id: "task-1",
      projectId: "project-1",
      status: "to-do",
      title: "t",
      userId: null,
    },
  });
});

describe("GitLab issue state webhooks", () => {
  it("ignores a close that echoes the close Kaneo just made", async () => {
    mocks.externalLinkFindFirst.mockResolvedValue(
      linkWithOutbound("closed", NOW),
    );

    await handleGitlabIssueClosed(payload("close", NOW + 500));

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
  });

  it("applies a reopen that lands inside the echo window after Kaneo closed the issue", async () => {
    // The echo window is about timing, but a reopen can never be the echo of a
    // close, so it must not be swallowed by someone toggling quickly.
    mocks.externalLinkFindFirst.mockResolvedValue(
      linkWithOutbound("closed", NOW),
    );

    await handleGitlabIssueReopened(payload("reopen", NOW + 500));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "to-do");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "to-do" }),
    );
  });

  it("applies a close once the echo window has passed", async () => {
    mocks.externalLinkFindFirst.mockResolvedValue(
      linkWithOutbound("closed", NOW - 60_000),
    );

    await handleGitlabIssueClosed(payload("close", NOW));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "done");
  });

  it("applies a close when Kaneo has never written the state itself", async () => {
    mocks.externalLinkFindFirst.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: JSON.stringify({ state: "opened" }),
    });

    await handleGitlabIssueClosed(payload("close", NOW));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "done");
  });

  it("does nothing when the issue has no linked task", async () => {
    mocks.externalLinkFindFirst.mockResolvedValue(undefined);

    await handleGitlabIssueClosed(payload("close", NOW));

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
  });
});
