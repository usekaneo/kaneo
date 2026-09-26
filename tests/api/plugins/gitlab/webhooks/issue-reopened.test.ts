import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateTaskStatus: vi.fn(),
  updateExternalLink: vi.fn(),
  publishEvent: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: {
        findFirst: async () => ({
          id: "link-1",
          taskId: "task-1",
          metadata: JSON.stringify({ state: "closed" }),
        }),
      },
      taskTable: {
        findFirst: async () => ({ id: "task-1", projectId: "project-1" }),
      },
    },
  },
}));

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: async () => [{ id: "integration-1" }],
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: async () => "to-do",
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    updateTaskStatus: (...args: unknown[]) => mocks.updateTaskStatus(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    updateExternalLink: (...args: unknown[]) =>
      mocks.updateExternalLink(...args),
  }),
);

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mocks.publishEvent(...args),
}));

const { handleGitlabIssueReopened } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-reopened"
);

const payload = {
  object_attributes: {
    iid: 3,
    title: "Checkout button overlaps the footer",
    url: "https://gitlab.com/acme/web/-/issues/3",
    state: "opened",
    action: "reopen",
  },
  project: {
    name: "web",
    web_url: "https://gitlab.com/acme/web",
    path_with_namespace: "acme/web",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleGitlabIssueReopened failures", () => {
  it("lets a failed status update reach the webhook route", async () => {
    mocks.updateTaskStatus.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      handleGitlabIssueReopened(payload, "integration-1"),
    ).rejects.toThrow("connection lost");
    expect(mocks.updateExternalLink).not.toHaveBeenCalled();
  });

  it("marks the link as opened after moving the task", async () => {
    mocks.updateTaskStatus.mockResolvedValueOnce({
      applied: true,
      before: { status: "done" },
      after: {
        id: "task-1",
        projectId: "project-1",
        status: "to-do",
        title: "Checkout button overlaps the footer",
        userId: null,
      },
    });

    await handleGitlabIssueReopened(payload, "integration-1");

    expect(mocks.updateExternalLink).toHaveBeenCalledWith("link-1", {
      metadata: { state: "opened" },
    });
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({
        sourceIntegrationId: "integration-1",
        newStatus: "to-do",
      }),
    );
  });
});
