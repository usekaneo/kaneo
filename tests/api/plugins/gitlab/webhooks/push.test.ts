import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  extractTaskNumberFromBranchGitlab: vi.fn(),
  findTaskByNumber: vi.fn(),
  isTaskInFinalState: vi.fn(),
  updateTaskStatus: vi.fn(),
  createOrUpdateExternalLink: vi.fn(),
  resolveTargetStatus: vi.fn(),
  publishEvent: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createOrUpdateExternalLink: (...a: unknown[]) =>
      mocks.createOrUpdateExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    findTaskByNumber: (...a: unknown[]) => mocks.findTaskByNumber(...a),
    isTaskInFinalState: (...a: unknown[]) => mocks.isTaskInFinalState(...a),
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
  "../../../../../apps/api/src/plugins/gitlab/utils/branch-matcher",
  () => ({
    extractTaskNumberFromBranchGitlab: (...a: unknown[]) =>
      mocks.extractTaskNumberFromBranchGitlab(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

const { handleGitlabPush } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/push"
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  config: JSON.stringify({
    baseUrl: "https://gitlab.example.com",
    statusTransitions: { onBranchPush: "in-progress" },
  }),
  project: {
    slug: "kan",
  },
};

function pushPayload(ref: string) {
  return {
    ref,
    commits: [
      {
        id: "abc123",
        message: "fix bug",
        author: { name: "octocat" },
        timestamp: "2026-01-01T00:00:00Z",
      },
    ],
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.extractTaskNumberFromBranchGitlab.mockReturnValue(5);
  mocks.findTaskByNumber.mockResolvedValue({
    id: "task-1",
    status: "to-do",
    columnId: null,
    projectId: "project-1",
  });
  mocks.resolveTargetStatus.mockResolvedValue("in-progress");
  mocks.isTaskInFinalState.mockResolvedValue(false);
  mocks.createOrUpdateExternalLink.mockResolvedValue({
    id: "link-1",
    created: true,
  });
  mocks.updateTaskStatus.mockResolvedValue({
    applied: true,
    before: { status: "to-do" },
    after: {
      id: "task-1",
      status: "in-progress",
      projectId: "project-1",
      title: "t",
      userId: null,
    },
  });
});

describe("handleGitlabPush", () => {
  it("skips a non-branch ref", async () => {
    await handleGitlabPush(pushPayload("refs/tags/v1.0.0"));
    expect(mocks.findAllIntegrationsByGitlabProject).not.toHaveBeenCalled();
  });

  it("skips a protected branch", async () => {
    await handleGitlabPush(pushPayload("refs/heads/main"));
    expect(mocks.findAllIntegrationsByGitlabProject).toHaveBeenCalled();
    expect(mocks.createOrUpdateExternalLink).not.toHaveBeenCalled();
  });

  it("links the branch and transitions the task status", async () => {
    await handleGitlabPush(pushPayload("refs/heads/kan-5-fix-bug"));

    expect(mocks.createOrUpdateExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        resourceType: "branch",
        externalId: "kan-5-fix-bug",
      }),
    );
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(
      "task-1",
      "in-progress",
    );
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "in-progress" }),
    );
  });
});
