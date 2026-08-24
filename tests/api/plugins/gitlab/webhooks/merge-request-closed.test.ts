import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  findTaskById: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateExternalLink: vi.fn(),
  resolveTargetStatus: vi.fn(),
  publishEvent: vi.fn(),
  externalLinkFindFirst: vi.fn(),
  externalLinkFindMany: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: {
        findFirst: (...a: unknown[]) => mocks.externalLinkFindFirst(...a),
        findMany: (...a: unknown[]) => mocks.externalLinkFindMany(...a),
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
    findTaskById: (...a: unknown[]) => mocks.findTaskById(...a),
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

const { handleGitlabMergeRequestClosed } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed"
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  config: JSON.stringify({ statusTransitions: { onMRMerge: "done" } }),
};

function mrClosedPayload(state: "closed" | "merged") {
  return {
    object_attributes: {
      iid: 9,
      title: "Fix bug",
      state,
      action: state === "merged" ? "merge" : "close",
      source_branch: "kan-5-fix-bug",
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
  mocks.externalLinkFindMany.mockResolvedValue([]);
  mocks.findTaskById.mockResolvedValue({ id: "task-1", status: "in-review" });
  mocks.resolveTargetStatus.mockResolvedValue("done");
  mocks.updateExternalLink.mockResolvedValue(undefined);
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "in-review" },
    after: { id: "task-1", status: "done", projectId: "project-1", title: "t", userId: null },
  });
});

describe("handleGitlabMergeRequestClosed", () => {
  it("transitions the task to the merge status only when the MR was actually merged", async () => {
    await handleGitlabMergeRequestClosed(mrClosedPayload("merged"));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-1", "done");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "done" }),
    );
  });

  it("does not transition the task on a plain close (not merged)", async () => {
    await handleGitlabMergeRequestClosed(mrClosedPayload("closed"));

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
    expect(mocks.updateExternalLink).toHaveBeenCalledWith(
      "link-1",
      expect.objectContaining({
        metadata: expect.objectContaining({ state: "closed", merged: false }),
      }),
    );
  });
});
