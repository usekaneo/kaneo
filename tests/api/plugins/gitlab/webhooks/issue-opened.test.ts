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
    baseUrl: "https://gitlab.com",
    projectPath: "usekaneo/kaneo",
    accessToken: "token",
  }),
};

function issueOpenedPayload(labels: Array<{ title: string }>) {
  return {
    user: { username: "octocat" },
    object_attributes: {
      iid: 42,
      title: "Fix the login bug",
      description: "Steps to reproduce",
      url: "https://gitlab.com/usekaneo/kaneo/-/issues/42",
      action: "open",
    },
    labels,
    project: {
      name: "kaneo",
      web_url: "https://gitlab.com/usekaneo/kaneo",
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
  it("persists a valid default priority when the issue has no priority: label", async () => {
    await handleGitlabIssueOpened(issueOpenedPayload([{ title: "type:bug" }]));

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("low");
  });

  it("reads the priority label out of the webhook's label titles", async () => {
    await handleGitlabIssueOpened(
      issueOpenedPayload([{ title: "type:bug" }, { title: "priority:high" }]),
    );

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("high");
  });

  it("records the issue link before publishing task.created", async () => {
    await handleGitlabIssueOpened(issueOpenedPayload([]));

    const linkOrder = mocks.createExternalLink.mock.invocationCallOrder[0];
    const eventOrder = mocks.publishEvent.mock.invocationCallOrder[0];
    expect(linkOrder).toBeLessThan(eventOrder);
    expect(mocks.createExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "issue",
        externalId: "42",
        url: "https://gitlab.com/usekaneo/kaneo/-/issues/42",
      }),
    );
  });

  it("keeps a confidential issue out of the workspace", async () => {
    const payload = issueOpenedPayload([]);
    await handleGitlabIssueOpened({
      ...payload,
      object_attributes: { ...payload.object_attributes, confidential: true },
    });

    expect(mocks.insertedValues).toHaveLength(0);
    expect(mocks.findAllIntegrationsByGitlabProject).not.toHaveBeenCalled();
  });

  it("skips an issue that already has a task", async () => {
    mocks.findExternalLink.mockResolvedValue({
      id: "link-1",
      taskId: "task-1",
    });

    await handleGitlabIssueOpened(issueOpenedPayload([]));

    expect(mocks.insertedValues).toHaveLength(0);
    expect(mocks.claimTaskNumber).not.toHaveBeenCalled();
  });
});
