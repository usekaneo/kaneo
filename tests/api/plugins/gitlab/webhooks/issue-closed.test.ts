import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateExternalLink: vi.fn(),
  resolveTargetStatus: vi.fn(),
  publishEvent: vi.fn(),
  externalLinkFindFirst: vi.fn(),
  taskFindFirst: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: {
        findFirst: (...a: unknown[]) => mocks.externalLinkFindFirst(...a),
      },
      taskTable: {
        findFirst: (...a: unknown[]) => mocks.taskFindFirst(...a),
      },
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

const { handleGitlabIssueClosed } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-closed"
);

const integration = { id: "integration-1", projectId: "project-1" };

function issueClosedPayload(updatedAt: string) {
  return {
    object_attributes: {
      iid: 42,
      title: "Fix bug",
      url: "https://gitlab.example.com/group/project/-/issues/42",
      state: "closed",
      action: "close",
      updated_at: updatedAt,
    },
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.externalLinkFindFirst.mockResolvedValue({
    id: "link-1",
    taskId: "task-1",
    metadata: null,
  });
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-1",
    projectId: "project-1",
  });
  mocks.resolveTargetStatus.mockResolvedValue("done");
  mocks.updateExternalLink.mockResolvedValue(undefined);
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "in-review" },
    after: {
      id: "task-1",
      status: "done",
      projectId: "project-1",
      title: "t",
      userId: null,
    },
  });
});

describe("handleGitlabIssueClosed", () => {
  it("transitions the linked task to the closed target status", async () => {
    await handleGitlabIssueClosed(issueClosedPayload("2026-01-01T00:00:00Z"));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "done");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "done" }),
    );
  });

  it("skips the sync when it falls inside the outbound echo window", async () => {
    mocks.externalLinkFindFirst.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: JSON.stringify({
        lastOutboundStateSyncAt: Date.parse("2026-01-01T00:00:00Z"),
      }),
    });

    await handleGitlabIssueClosed(issueClosedPayload("2026-01-01T00:00:01Z"));

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
  });
});
