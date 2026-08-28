import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGitlabIssueOpened } from "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-opened";

const mocks = vi.hoisted(() => {
  const insertedValues: Array<Record<string, unknown>> = [];

  return {
    insertedValues,
    findAllIntegrationsByGitlabProject: vi.fn(),
    findExternalLink: vi.fn(),
    createExternalLink: vi.fn(),
    claimTaskNumber: vi.fn(),
    resolveTargetStatus: vi.fn(),
    publishEvent: vi.fn(),
    columnFindFirst: vi.fn(),
    projectFindFirst: vi.fn(),
    createGitlabClient: vi.fn(),
    addLabelsToIssueGitlab: vi.fn(),
    db: {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues.push(values);
          return { returning: async () => [{ id: "task-1", number: 7 }] };
        },
      }),
      query: {
        columnTable: {
          findFirst: (...args: unknown[]) => mocks.columnFindFirst(...args),
        },
        projectTable: {
          findFirst: (...args: unknown[]) => mocks.projectFindFirst(...args),
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
  "../../../../../apps/api/src/task/controllers/claim-task-numbers",
  () => ({
    claimTaskNumber: (...args: unknown[]) => mocks.claimTaskNumber(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createExternalLink: (...args: unknown[]) =>
      mocks.createExternalLink(...args),
    findExternalLink: (...args: unknown[]) => mocks.findExternalLink(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...args: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...args: unknown[]) =>
      mocks.resolveTargetStatus(...args),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: (...args: unknown[]) => mocks.createGitlabClient(...args),
}));

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: (...args: unknown[]) =>
    mocks.addLabelsToIssueGitlab(...args),
}));

const integration = {
  id: "integration-1",
  projectId: "project-1",
  isActive: true,
  type: "gitlab",
  config: JSON.stringify({
    baseUrl: "https://gitlab.example.com",
    accessToken: "token",
    namespace: "usekaneo",
    projectPath: "kaneo",
  }),
};

// GitLab names a webhook label's text `title`, not `name`.
function issueOpenedPayload(labels: Array<{ title: string; color?: string }>) {
  return {
    object_kind: "issue",
    object_attributes: {
      iid: 42,
      title: "Fix the login bug",
      description: "Steps to reproduce",
      url: "https://gitlab.example.com/usekaneo/kaneo/-/issues/42",
      state: "opened",
      action: "open",
    },
    labels,
    user: { username: "octocat", name: "Octo Cat" },
    project: {
      id: 3,
      name: "kaneo",
      web_url: "https://gitlab.example.com/usekaneo/kaneo",
      path_with_namespace: "usekaneo/kaneo",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedValues.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.findExternalLink.mockResolvedValue(null);
  mocks.claimTaskNumber.mockResolvedValue(7);
  mocks.resolveTargetStatus.mockResolvedValue("to-do");
  mocks.columnFindFirst.mockResolvedValue(null);
  mocks.projectFindFirst.mockResolvedValue(null);
  mocks.createExternalLink.mockResolvedValue({ id: "link-1" });
  mocks.publishEvent.mockResolvedValue(undefined);
});

describe("handleGitlabIssueOpened", () => {
  it("looks the integration up by instance root and full project path", async () => {
    await handleGitlabIssueOpened(issueOpenedPayload([]));

    expect(mocks.findAllIntegrationsByGitlabProject).toHaveBeenCalledWith(
      "https://gitlab.example.com",
      "usekaneo/kaneo",
      undefined,
    );
  });

  it("persists a valid default priority when the issue has no priority: label", async () => {
    await handleGitlabIssueOpened(issueOpenedPayload([{ title: "type:bug" }]));

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("low");
  });

  it("reads priority and status out of the webhook's label titles", async () => {
    await handleGitlabIssueOpened(
      issueOpenedPayload([
        { title: "type:bug" },
        { title: "priority:high" },
        { title: "status:in-progress" },
      ]),
    );

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("high");
    expect(mocks.resolveTargetStatus).toHaveBeenCalledWith(
      "project-1",
      "issue_opened",
      "in-progress",
    );
  });

  it("links the task to the issue's iid, not its instance-wide id", async () => {
    await handleGitlabIssueOpened(issueOpenedPayload([]));

    expect(mocks.createExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "issue",
        externalId: "42",
        url: "https://gitlab.example.com/usekaneo/kaneo/-/issues/42",
        metadata: expect.objectContaining({
          state: "opened",
          createdFrom: "gitlab",
          author: "octocat",
        }),
      }),
    );
  });

  it("does nothing when the issue already has a task", async () => {
    mocks.findExternalLink.mockResolvedValue({ id: "link-1" });

    await handleGitlabIssueOpened(issueOpenedPayload([]));

    expect(mocks.insertedValues).toHaveLength(0);
    expect(mocks.createExternalLink).not.toHaveBeenCalled();
  });
});
