import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGitlabIssueUpdated } from "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-updated";

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
    db: {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          taskUpdates.push(values);
          return { where: async () => undefined };
        },
      }),
      query: {
        taskTable: {
          findFirst: (...args: unknown[]) => mocks.taskFindFirst(...args),
        },
      },
    },
  };
});

vi.mock("../../../../../apps/api/src/database", () => ({ default: mocks.db }));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mocks.publishEvent(...args),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLink: (...args: unknown[]) => mocks.findExternalLink(...args),
    updateExternalLink: (...args: unknown[]) =>
      mocks.updateExternalLink(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    updateTaskStatus: (...args: unknown[]) => mocks.updateTaskStatus(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...args: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...args),
  }),
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  isActive: true,
  type: "gitlab",
  config: JSON.stringify({
    baseUrl: "https://gitlab.com",
    projectPath: "usekaneo/kaneo",
    accessToken: "token",
  }),
};

function titleChangedPayload(title: string) {
  return {
    object_attributes: {
      iid: 42,
      title,
      description: "Steps to reproduce",
      url: "https://gitlab.com/usekaneo/kaneo/-/issues/42",
      action: "update",
    },
    changes: {
      title: { previous: "Old title", current: title },
    },
    project: {
      name: "kaneo",
      web_url: "https://gitlab.com/usekaneo/kaneo",
      path_with_namespace: "usekaneo/kaneo",
    },
  };
}

function linkWithLastTitleWrittenByKaneo(title: string) {
  return {
    id: "link-1",
    taskId: "task-1",
    metadata: JSON.stringify({
      state: "open",
      lastSync: {
        title: {
          // Just now, so a window-based guard would swallow both cases below.
          timestamp: new Date().toISOString(),
          source: "kaneo",
          value: title,
        },
      },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.taskUpdates.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-1",
    projectId: "project-1",
    project: { workspaceId: "workspace-1" },
  });
  mocks.updateExternalLink.mockResolvedValue(undefined);
});

describe("handleGitlabIssueUpdated", () => {
  it("applies a title edit that arrives from GitLab", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: JSON.stringify({ state: "open" }),
    });

    await handleGitlabIssueUpdated(titleChangedPayload("Fix the login bug"));

    expect(mocks.taskUpdates).toEqual([{ title: "Fix the login bug" }]);
  });

  it("ignores the echo of a title Kaneo just wrote", async () => {
    mocks.findExternalLink.mockResolvedValue(
      linkWithLastTitleWrittenByKaneo("Written by Kaneo"),
    );

    await handleGitlabIssueUpdated(titleChangedPayload("Written by Kaneo"));

    expect(mocks.taskUpdates).toHaveLength(0);
    expect(mocks.updateExternalLink).not.toHaveBeenCalled();
  });

  it("keeps a different title edited right after Kaneo's own write", async () => {
    mocks.findExternalLink.mockResolvedValue(
      linkWithLastTitleWrittenByKaneo("Written by Kaneo"),
    );

    await handleGitlabIssueUpdated(titleChangedPayload("Edited in GitLab"));

    expect(mocks.taskUpdates).toEqual([{ title: "Edited in GitLab" }]);
  });

  it("does nothing when the update changed neither text nor labels", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
      metadata: null,
    });

    await handleGitlabIssueUpdated({
      ...titleChangedPayload("Fix the login bug"),
      changes: {},
    });

    expect(mocks.findExternalLink).not.toHaveBeenCalled();
    expect(mocks.taskUpdates).toHaveLength(0);
  });
});
