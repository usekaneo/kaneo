import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGiteaIssueOpened } from "../../../../../apps/api/src/plugins/gitea/webhooks/issue-opened";

const mocks = vi.hoisted(() => {
  const insertedValues: Array<Record<string, unknown>> = [];

  return {
    insertedValues,
    findAllIntegrationsByGiteaRepo: vi.fn(),
    findExternalLink: vi.fn(),
    createExternalLink: vi.fn(),
    claimTaskNumber: vi.fn(),
    resolveTargetStatus: vi.fn(),
    publishEvent: vi.fn(),
    columnFindFirst: vi.fn(),
    projectFindFirst: vi.fn(),
    createGiteaClient: vi.fn(),
    addLabelsToIssueGitea: vi.fn(),
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
  "../../../../../apps/api/src/plugins/gitea/services/integration-lookup",
  () => ({
    findAllIntegrationsByGiteaRepo: (...args: unknown[]) =>
      mocks.findAllIntegrationsByGiteaRepo(...args),
    repoOwnerLogin: (repository: { owner: { login?: string } }) =>
      repository.owner.login ?? "",
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitea/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...args: unknown[]) =>
      mocks.resolveTargetStatus(...args),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: (...args: unknown[]) => mocks.createGiteaClient(...args),
}));

vi.mock("../../../../../apps/api/src/plugins/gitea/utils/labels", () => ({
  addLabelsToIssueGitea: (...args: unknown[]) =>
    mocks.addLabelsToIssueGitea(...args),
}));

const integration = {
  id: "integration-1",
  projectId: "project-1",
  isActive: true,
  type: "gitea",
  config: JSON.stringify({
    baseUrl: "https://gitea.example.com",
    repositoryOwner: "usekaneo",
    repositoryName: "kaneo",
    token: "token",
  }),
};

function issueOpenedPayload(labels: Array<string | { name?: string }>) {
  return {
    action: "opened",
    issue: {
      number: 42,
      title: "Fix the login bug",
      body: "Steps to reproduce",
      html_url: "https://gitea.example.com/usekaneo/kaneo/issues/42",
      labels,
      user: { login: "octocat" },
    },
    repository: {
      owner: { login: "usekaneo" },
      name: "kaneo",
      html_url: "https://gitea.example.com/usekaneo/kaneo",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedValues.length = 0;
  mocks.findAllIntegrationsByGiteaRepo.mockResolvedValue([integration]);
  mocks.findExternalLink.mockResolvedValue(null);
  mocks.claimTaskNumber.mockResolvedValue(7);
  mocks.resolveTargetStatus.mockResolvedValue("to-do");
  mocks.columnFindFirst.mockResolvedValue(null);
  mocks.projectFindFirst.mockResolvedValue(null);
  mocks.createExternalLink.mockResolvedValue({ id: "link-1" });
  mocks.publishEvent.mockResolvedValue(undefined);
});

describe("handleGiteaIssueOpened", () => {
  it("persists a valid default priority when the issue has no priority: label", async () => {
    await handleGiteaIssueOpened(issueOpenedPayload(["type:bug"]));

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).not.toBeNull();
    expect(mocks.insertedValues[0].priority).toBe("low");
  });

  it("persists the extracted priority label when present", async () => {
    await handleGiteaIssueOpened(
      issueOpenedPayload(["type:bug", "priority:high"]),
    );

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("high");
  });
});
