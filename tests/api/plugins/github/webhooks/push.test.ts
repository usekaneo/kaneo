import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByRepo: vi.fn(),
  findTaskById: vi.fn(),
  findTaskByNumber: vi.fn(),
  isTaskInFinalState: vi.fn(),
  updateTaskStatus: vi.fn(),
  findExternalLink: vi.fn(),
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
    findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
    createOrUpdateExternalLink: (...a: unknown[]) =>
      mocks.createOrUpdateExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    findAllIntegrationsByRepo: (...a: unknown[]) =>
      mocks.findAllIntegrationsByRepo(...a),
    findTaskById: (...a: unknown[]) => mocks.findTaskById(...a),
    findTaskByNumber: (...a: unknown[]) => mocks.findTaskByNumber(...a),
    isTaskInFinalState: (...a: unknown[]) => mocks.isTaskInFinalState(...a),
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

const { handlePush } = await import(
  "../../../../../apps/api/src/plugins/github/webhooks/push"
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  config: JSON.stringify({ branchPattern: "{slug}-{number}" }),
  project: { slug: "kan" },
};

function pushPayload(
  ref: string,
  commitMessage: string,
): Parameters<typeof handlePush>[0] {
  const commit = {
    id: "abc123",
    message: commitMessage,
    author: { name: "octocat" },
    timestamp: "2026-01-01T00:00:00Z",
  };
  return {
    ref,
    head_commit: commit,
    commits: [commit],
    repository: {
      owner: { login: "acme" },
      name: "repo",
      html_url: "https://github.com/acme/repo",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAllIntegrationsByRepo.mockResolvedValue([integration]);
  mocks.findExternalLink.mockResolvedValue(null);
  mocks.findTaskByNumber.mockResolvedValue(null);
  mocks.isTaskInFinalState.mockResolvedValue(false);
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

describe("handlePush commit-close", () => {
  it("closes the task behind an issue a commit says it fixes, on a feature branch", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-issue",
      taskId: "task-9",
    });
    mocks.findTaskById.mockResolvedValue({
      id: "task-9",
      status: "in-progress",
      columnId: null,
      projectId: "project-1",
      title: "t",
      userId: null,
    });

    await handlePush(
      pushPayload("refs/heads/some-feature", "fix login\n\nfixes #45"),
    );

    expect(mocks.findExternalLink).toHaveBeenCalledWith(
      "integration-1",
      "issue",
      "45",
    );
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-9", "done");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({ newStatus: "done" }),
    );
  });

  it("honors closing keywords even on a protected branch", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-issue",
      taskId: "task-9",
    });
    mocks.findTaskById.mockResolvedValue({
      id: "task-9",
      status: "in-progress",
      columnId: null,
      projectId: "project-1",
      title: "t",
      userId: null,
    });

    await handlePush(pushPayload("refs/heads/main", "hotfix (closes #45)"));

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith("task-9", "done");
    // Branch-status transition is still skipped for protected branches.
    expect(mocks.createOrUpdateExternalLink).not.toHaveBeenCalled();
  });

  it("does nothing when the commit has no closing keyword", async () => {
    await handlePush(
      pushPayload("refs/heads/main", "chore: mention #45 in passing"),
    );

    expect(mocks.findExternalLink).not.toHaveBeenCalled();
    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
  });

  it("leaves an already-final task untouched", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-issue",
      taskId: "task-9",
    });
    mocks.findTaskById.mockResolvedValue({
      id: "task-9",
      status: "done",
      columnId: null,
      projectId: "project-1",
      title: "t",
      userId: null,
    });
    mocks.isTaskInFinalState.mockResolvedValue(true);

    await handlePush(pushPayload("refs/heads/some-feature", "closes #45"));

    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
  });
});
