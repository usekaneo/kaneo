import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findExternalLinksByTask: vi.fn(),
  updateExternalLink: vi.fn(),
  updateIssue: vi.fn(),
  findUserByEmail: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      userTable: {
        findFirst: (...a: unknown[]) => mocks.userFindFirst(...a),
      },
    },
  },
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
    findUserByEmail: (...a: unknown[]) => mocks.findUserByEmail(...a),
  }),
}));

const { handleTaskAssigneeChanged } = await import(
  "../../../../../apps/api/src/plugins/gitlab/events/task-assignee-changed"
);

const { handleTaskUnassigned } = await import(
  "../../../../../apps/api/src/plugins/gitlab/events/task-unassigned"
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
  mocks.userFindFirst.mockResolvedValue({
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
  });
  mocks.findUserByEmail.mockResolvedValue({
    id: 123,
    username: "johndoe",
    email: "john@example.com",
  });
});

describe("handleTaskAssigneeChanged", () => {
  it("assigns the GitLab issue to the user with matching email", async () => {
    await handleTaskAssigneeChanged(
      {
        taskId: "task-1",
        projectId: "project-1",
        userId: "user-actor",
        oldAssignee: null,
        newAssignee: "John Doe",
        newAssigneeId: "user-1",
        title: "Task 1",
      },
      context,
    );

    expect(mocks.findUserByEmail).toHaveBeenCalledWith(
      "john@example.com",
      "group/project",
      "John Doe",
    );
    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      assignee_ids: [123],
    });
    expect(mocks.updateExternalLink).toHaveBeenCalledWith(
      "link-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          lastSync: expect.objectContaining({
            assignee: expect.objectContaining({
              source: "kaneo",
              value: "john@example.com",
            }),
          }),
        }),
      }),
    );
  });
});

describe("handleTaskUnassigned", () => {
  it("unassigns the GitLab issue by setting assignee_ids to [0]", async () => {
    await handleTaskUnassigned(
      {
        taskId: "task-1",
        projectId: "project-1",
        userId: "user-actor",
        title: "Task 1",
      },
      context,
    );

    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      assignee_ids: [0],
    });
  });
});
