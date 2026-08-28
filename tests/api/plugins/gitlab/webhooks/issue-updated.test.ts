import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const taskUpdates: Array<Record<string, unknown>> = [];

  return {
    taskUpdates,
    findAllIntegrationsByGitlabProject: vi.fn(),
    findExternalLink: vi.fn(),
    updateExternalLink: vi.fn(),
    updateTaskStatus: vi.fn(),
    publishEvent: vi.fn(),
    taskFindFirst: vi.fn(),
    syncIssueLabelsToTask: vi.fn(),
    db: {
      query: {
        taskTable: {
          findFirst: (...a: unknown[]) => mocks.taskFindFirst(...a),
        },
      },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          taskUpdates.push(values);
          return { where: async () => undefined };
        },
      }),
    },
  };
});

vi.mock("../../../../../apps/api/src/database", () => ({ default: mocks.db }));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
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

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/task-labels", () => ({
  syncIssueLabelsToTask: (...a: unknown[]) => mocks.syncIssueLabelsToTask(...a),
}));

const { handleGitlabIssueUpdated } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-updated"
);

const project = {
  web_url: "https://gitlab.example.com/usekaneo/kaneo",
  path_with_namespace: "usekaneo/kaneo",
};

function updatePayload(
  title: string,
  changes: Record<string, unknown>,
  labels: Array<{ title: string }> = [],
) {
  return {
    object_kind: "issue",
    object_attributes: {
      iid: 42,
      title,
      description: "body",
      url: "https://gitlab.example.com/usekaneo/kaneo/-/issues/42",
      state: "opened",
      action: "update",
    },
    labels,
    changes,
    project,
  };
}

/** A link whose last title sync was written by Kaneo just now. */
function linkWithKaneoTitleSync(value: string) {
  return {
    id: "link-1",
    taskId: "task-1",
    metadata: JSON.stringify({
      lastSync: {
        title: {
          timestamp: new Date().toISOString(),
          source: "kaneo",
          value,
        },
      },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.taskUpdates.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([
    { id: "integration-1", projectId: "project-1" },
  ]);
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-1",
    priority: "high",
    project: { workspaceId: "workspace-1" },
  });
  mocks.updateExternalLink.mockResolvedValue(undefined);
});

describe("handleGitlabIssueUpdated", () => {
  it("drops the echo of a title Kaneo just wrote", async () => {
    mocks.findExternalLink.mockResolvedValue(
      linkWithKaneoTitleSync("Kaneo title"),
    );

    await handleGitlabIssueUpdated(
      updatePayload("Kaneo title", { title: { previous: "Old" } }),
    );

    expect(mocks.taskUpdates).toHaveLength(0);
  });

  it("keeps a real GitLab edit made inside the echo window", async () => {
    // The previous guard suppressed anything arriving within 2s of a Kaneo
    // write, losing the user's edit.
    mocks.findExternalLink.mockResolvedValue(
      linkWithKaneoTitleSync("Kaneo title"),
    );

    await handleGitlabIssueUpdated(
      updatePayload("A human renamed it", {
        title: { previous: "Kaneo title" },
      }),
    );

    expect(mocks.taskUpdates).toHaveLength(1);
    expect(mocks.taskUpdates[0].title).toBe("A human renamed it");
  });

  it("falls back to the default priority when the label is removed", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: null,
    });

    await handleGitlabIssueUpdated(
      updatePayload("Title", { labels: { previous: [], current: [] } }, []),
    );

    expect(mocks.taskUpdates).toHaveLength(1);
    expect(mocks.taskUpdates[0].priority).toBe("low");
  });

  it("leaves the priority alone when it already matches the default", async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: "task-1",
      priority: "low",
      project: { workspaceId: "workspace-1" },
    });
    mocks.findExternalLink.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: null,
    });

    await handleGitlabIssueUpdated(
      updatePayload("Title", { labels: { previous: [], current: [] } }, []),
    );

    expect(mocks.taskUpdates).toHaveLength(0);
  });
});
