import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

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

const { handleGitlabIssueReopened } =
  await import("../../../../../apps/api/src/plugins/gitlab/webhooks/issue-reopened");

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

    expect(mocks.updateExternalLink).toHaveBeenCalledWith(
      "link-1",
      {
        metadata: { state: "opened" },
      },
      expect.anything(),
    );
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({
        sourceIntegrationId: "integration-1",
        newStatus: "to-do",
      }),
    );
  });
});

// Ownership locking is covered by integration-task-scope.test.ts. These cases
// exercise provider behavior with the transaction's existing database mock.
vi.mock(
  "../../../../../apps/api/src/plugins/github/services/integration-task-scope",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../../../apps/api/src/plugins/github/services/integration-task-scope")
      >();
    return {
      ...actual,
      withIntegrationTask: async (
        _taskId: string,
        _integration: unknown,
        apply: (
          database: unknown,
          afterCommit: (effect: () => Promise<void>) => void,
        ) => Promise<unknown>,
      ) => {
        const database = (await import("../../../../../apps/api/src/database"))
          .default;
        const effects: Array<() => Promise<void>> = [];
        const result = await apply(database, (effect) => effects.push(effect));
        for (const effect of effects) await effect();
        return result;
      },
    };
  },
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/with-integration-link",
  async () => ({
    withIntegrationLink: async (
      link: unknown,
      integration: unknown,
      apply: (
        database: unknown,
        afterCommit: (effect: () => Promise<void>) => void,
        link: unknown,
      ) => Promise<unknown>,
    ) => {
      const { withIntegrationTask } =
        await import("../../../../../apps/api/src/plugins/github/services/integration-task-scope");
      return withIntegrationTask(
        (link as { taskId: string }).taskId,
        integration as Parameters<typeof withIntegrationTask>[1],
        (database, afterCommit) => apply(database, afterCommit, link),
      );
    },
  }),
);
