import { beforeEach, describe, expect, it, vi } from "vitest";

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
          findFirst: (...a: unknown[]) => mocks.columnFindFirst(...a),
        },
        projectTable: {
          findFirst: (...a: unknown[]) => mocks.projectFindFirst(...a),
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
  "../../../../../apps/api/src/task/controllers/claim-task-numbers",
  () => ({
    claimTaskNumber: (...a: unknown[]) => mocks.claimTaskNumber(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createExternalLink: (...a: unknown[]) => mocks.createExternalLink(...a),
    findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
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
  "../../../../../apps/api/src/plugins/gitlab/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...a: unknown[]) => mocks.resolveTargetStatus(...a),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: (...a: unknown[]) => mocks.createGitlabClient(...a),
}));

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: (...a: unknown[]) =>
    mocks.addLabelsToIssueGitlab(...a),
}));

const { handleGitlabIssueOpened } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-opened"
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

function issueOpenedPayload(labels: Array<{ title: string }>) {
  return {
    object_attributes: {
      iid: 42,
      title: "Fix the login bug",
      description: "Steps to reproduce",
      url: "https://gitlab.example.com/group/project/-/issues/42",
      state: "opened",
      action: "open",
    },
    labels,
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
    user: { username: "octocat" },
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
  mocks.createGitlabClient.mockReturnValue({
    createIssueNote: vi.fn().mockResolvedValue({}),
  });
});

describe("handleGitlabIssueOpened", () => {
  it("persists a valid default priority when the issue has no priority: label", async () => {
    await handleGitlabIssueOpened(issueOpenedPayload([{ title: "type:bug" }]));

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("low");
  });

  it("persists the extracted priority label when present", async () => {
    await handleGitlabIssueOpened(
      issueOpenedPayload([{ title: "type:bug" }, { title: "priority:high" }]),
    );

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("high");
  });
});
