import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const updatedTasks: Array<{ id: string; values: Record<string, unknown> }> =
    [];
  return {
    updatedTasks,
    findAllIntegrationsByGitlabProject: vi.fn(),
    findExternalLink: vi.fn(),
    updateExternalLink: vi.fn(),
    publishEvent: vi.fn(),
    taskFindFirst: vi.fn(),
    userFindFirst: vi.fn(),
    db: {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updatedTasks.push({ id: "task-1", values });
          },
        }),
      }),
      query: {
        taskTable: {
          findFirst: (...a: unknown[]) => mocks.taskFindFirst(...a),
        },
        userTable: {
          findFirst: (...a: unknown[]) => mocks.userFindFirst(...a),
        },
      },
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
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

const { handleGitlabIssueEdited } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-edited"
);

const integration = {
  id: "integration-1",
  projectId: "project-1",
  config: JSON.stringify({
    baseUrl: "https://gitlab.example.com",
    repositoryPath: "group/project",
    accessToken: "token",
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updatedTasks.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.findExternalLink.mockResolvedValue({
    id: "link-1",
    taskId: "task-1",
    metadata: null,
  });
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-1",
    projectId: "project-1",
    userId: null,
    title: "Task 1",
  });
  mocks.updateExternalLink.mockResolvedValue(undefined);
  mocks.publishEvent.mockResolvedValue(undefined);
});

describe("handleGitlabIssueEdited", () => {
  it("updates task assignee when assignee changes in GitLab", async () => {
    mocks.userFindFirst.mockResolvedValueOnce({
      id: "user-2",
      name: "Jane Dev",
      email: "jane@example.com",
    });

    await handleGitlabIssueEdited({
      object_attributes: {
        iid: 42,
        title: "Task 1",
        description: null,
        url: "https://gitlab.example.com/group/project/-/issues/42",
        action: "update",
      },
      assignees: [
        {
          id: 202,
          name: "Jane Dev",
          username: "janedev",
          email: "jane@example.com",
        },
      ],
      changes: {
        assignees: {
          previous: [],
          current: [{ name: "Jane Dev", username: "janedev" }],
        },
      },
      project: {
        path_with_namespace: "group/project",
        web_url: "https://gitlab.example.com/group/project",
      },
    });

    expect(mocks.updatedTasks).toHaveLength(1);
    expect(mocks.updatedTasks[0].values.userId).toBe("user-2");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.assignee_changed",
      expect.objectContaining({
        taskId: "task-1",
        newAssigneeId: "user-2",
      }),
    );
  });

  it("unassigns task when issue assignees are cleared in GitLab", async () => {
    mocks.taskFindFirst.mockResolvedValueOnce({
      id: "task-1",
      projectId: "project-1",
      userId: "user-2",
      title: "Task 1",
    });

    await handleGitlabIssueEdited({
      object_attributes: {
        iid: 42,
        title: "Task 1",
        description: null,
        url: "https://gitlab.example.com/group/project/-/issues/42",
        action: "update",
      },
      assignees: [],
      changes: {
        assignees: {
          previous: [{ name: "Jane Dev", username: "janedev" }],
          current: [],
        },
      },
      project: {
        path_with_namespace: "group/project",
        web_url: "https://gitlab.example.com/group/project",
      },
    });

    expect(mocks.updatedTasks).toHaveLength(1);
    expect(mocks.updatedTasks[0].values.userId).toBeNull();
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      "task.unassigned",
      expect.objectContaining({
        taskId: "task-1",
      }),
    );
  });
});
