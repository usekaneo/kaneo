import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findExternalLinksByTask: vi.fn(),
  updateExternalLink: vi.fn(),
  updateIssue: vi.fn(),
  addLabelsToIssueGitlab: vi.fn(),
  removeLabelGitlab: vi.fn(),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLinksByTask: (...a: unknown[]) =>
      mocks.findExternalLinksByTask(...a),
    updateExternalLink: (...a: unknown[]) => mocks.updateExternalLink(...a),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    updateIssue: (...a: unknown[]) => mocks.updateIssue(...a),
  }),
}));

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: (...a: unknown[]) =>
    mocks.addLabelsToIssueGitlab(...a),
  removeLabelGitlab: (...a: unknown[]) => mocks.removeLabelGitlab(...a),
}));

const { handleTaskStatusChanged } = await import(
  "../../../../../apps/api/src/plugins/gitlab/events/task-status-changed"
);

const context = {
  integrationId: "integration-1",
  projectId: "project-1",
  config: {
    baseUrl: "https://gitlab.example.com",
    accessToken: "token",
    repositoryPath: "group/project",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findExternalLinksByTask.mockResolvedValue([
    {
      id: "link-1",
      integrationId: "integration-1",
      resourceType: "issue",
      externalId: "5",
      metadata: null,
    },
  ]);
});

describe("handleTaskStatusChanged", () => {
  it("closes the GitLab issue via state_event when the task reaches done", async () => {
    await handleTaskStatusChanged(
      {
        taskId: "task-1",
        projectId: "project-1",
        userId: null,
        oldStatus: "in-review",
        newStatus: "done",
        title: "t",
      },
      context,
    );

    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      state_event: "close",
    });
  });

  it("reopens the GitLab issue via state_event when the task leaves done", async () => {
    await handleTaskStatusChanged(
      {
        taskId: "task-1",
        projectId: "project-1",
        userId: null,
        oldStatus: "done",
        newStatus: "to-do",
        title: "t",
      },
      context,
    );

    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      state_event: "reopen",
    });
  });

  it("does not touch issue state for a non-done transition", async () => {
    await handleTaskStatusChanged(
      {
        taskId: "task-1",
        projectId: "project-1",
        userId: null,
        oldStatus: "to-do",
        newStatus: "in-progress",
        title: "t",
      },
      context,
    );

    expect(mocks.updateIssue).not.toHaveBeenCalled();
  });
});
