import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByRepo: vi.fn(),
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
      externalLinkTable: { findFirst: mocks.externalLinkFindFirst },
      taskTable: { findFirst: mocks.taskFindFirst },
    },
  },
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    findAllIntegrationsByRepo: (...a: unknown[]) =>
      mocks.findAllIntegrationsByRepo(...a),
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    updateExternalLink: (...a: unknown[]) => mocks.updateExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

const { handleIssueClosed } = await import(
  "../../../../../apps/api/src/plugins/github/webhooks/issue-closed"
);

function closedPayload(updatedAt: string) {
  return {
    action: "closed",
    issue: {
      number: 45,
      title: "Fix login",
      html_url: "https://github.com/acme/repo/issues/45",
      state: "closed",
      updated_at: updatedAt,
    },
    repository: {
      owner: { login: "acme" },
      name: "repo",
      full_name: "acme/repo",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAllIntegrationsByRepo.mockResolvedValue([
    { id: "integration-1", projectId: "project-1" },
  ]);
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-9",
    projectId: "project-1",
    status: "in-progress",
  });
  mocks.resolveTargetStatus.mockResolvedValue("done");
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "in-progress" },
    after: {
      id: "task-9",
      status: "done",
      projectId: "project-1",
      title: "t",
      userId: null,
    },
  });
});

describe("handleIssueClosed", () => {
  it("closes the task even for a Kaneo-created issue (no echo stamp)", async () => {
    mocks.externalLinkFindFirst.mockResolvedValue({
      id: "link-1",
      taskId: "task-9",
      metadata: JSON.stringify({ createdFrom: "kaneo" }),
    });

    await handleIssueClosed(closedPayload("2026-06-01T00:00:00Z"));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-9", "done");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "done" }),
    );
  });

  it("skips the echo of our own outbound close", async () => {
    const stamp = Date.parse("2026-06-01T00:00:00Z");
    mocks.externalLinkFindFirst.mockResolvedValue({
      id: "link-1",
      taskId: "task-9",
      metadata: JSON.stringify({
        createdFrom: "kaneo",
        lastOutboundStateSyncAt: stamp,
      }),
    });

    // Webhook fires ~1s after our own write -> treated as the echo.
    await handleIssueClosed(
      closedPayload(new Date(stamp + 1000).toISOString()),
    );

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
    expect(mocks.publishEvent).not.toHaveBeenCalled();
  });

  it("still closes when the external close is well after our last write", async () => {
    const stamp = Date.parse("2026-06-01T00:00:00Z");
    mocks.externalLinkFindFirst.mockResolvedValue({
      id: "link-1",
      taskId: "task-9",
      metadata: JSON.stringify({ lastOutboundStateSyncAt: stamp }),
    });

    await handleIssueClosed(
      closedPayload(new Date(stamp + 3_600_000).toISOString()),
    );

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-9", "done");
  });
});
