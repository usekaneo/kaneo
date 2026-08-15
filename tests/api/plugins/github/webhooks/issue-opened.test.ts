import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleIssueOpened } from "../../../../../apps/api/src/plugins/github/webhooks/issue-opened";

const mocks = vi.hoisted(() => {
  const mockGetGithubApp = vi.fn();
  const mockFindAllIntegrationsByRepo = vi.fn();
  const mockFindExternalLink = vi.fn();
  const mockCreateExternalLink = vi.fn();
  const mockClaimTaskNumber = vi.fn();
  const mockResolveTargetStatus = vi.fn();
  const mockAddLabelsToIssue = vi.fn();
  const mockCreateComment = vi.fn();
  const mockGetInstallationOctokit = vi.fn();
  const mockColumnFindFirst = vi.fn();
  const mockProjectFindFirst = vi.fn();

  const insertedValues: Array<Record<string, unknown>> = [];

  const mockDb = {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        insertedValues.push(values);
        return {
          returning: async () => [{ id: "task-1" }],
        };
      },
    }),
    query: {
      columnTable: { findFirst: mockColumnFindFirst },
      projectTable: { findFirst: mockProjectFindFirst },
    },
  };

  const mockOctokit = {
    rest: {
      issues: {
        createComment: mockCreateComment,
      },
    },
  };

  const mockGithubApp = {
    getInstallationOctokit: mockGetInstallationOctokit,
  };

  return {
    mockGetGithubApp,
    mockFindAllIntegrationsByRepo,
    mockFindExternalLink,
    mockCreateExternalLink,
    mockClaimTaskNumber,
    mockResolveTargetStatus,
    mockAddLabelsToIssue,
    mockCreateComment,
    mockGetInstallationOctokit,
    mockColumnFindFirst,
    mockProjectFindFirst,
    mockDb,
    insertedValues,
    mockOctokit,
    mockGithubApp,
  };
});

vi.mock("../../../../../apps/api/src/database", () => ({
  default: mocks.mockDb,
}));

vi.mock("../../../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => mocks.mockGetGithubApp(),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    findAllIntegrationsByRepo: (...args: unknown[]) =>
      mocks.mockFindAllIntegrationsByRepo(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createExternalLink: (...args: unknown[]) =>
      mocks.mockCreateExternalLink(...args),
    findExternalLink: (...args: unknown[]) =>
      mocks.mockFindExternalLink(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/task/controllers/claim-task-numbers",
  () => ({
    claimTaskNumber: (...args: unknown[]) => mocks.mockClaimTaskNumber(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...args: unknown[]) =>
      mocks.mockResolveTargetStatus(...args),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/github/utils/labels", () => ({
  addLabelsToIssue: (...args: unknown[]) => mocks.mockAddLabelsToIssue(...args),
}));

const integration = {
  id: "integration-1",
  projectId: "project-1",
  isActive: true,
  type: "github",
  config: JSON.stringify({
    repositoryOwner: "usekaneo",
    repositoryName: "kaneo",
    installationId: 123,
    commentTaskLinkOnGitHubIssue: true,
    branchPattern: "{slug}-{number}",
    statusTransitions: {
      onBranchPush: "in-progress",
      onPROpen: "in-review",
      onPRMerge: "done",
    },
  }),
  project: null,
};

function issueOpenedPayload(labels: Array<string | { name?: string }>) {
  return {
    action: "opened",
    issue: {
      number: 42,
      title: "Fix the login bug",
      body: "Steps to reproduce",
      html_url: "https://github.com/usekaneo/kaneo/issues/42",
      labels,
      user: { login: "octocat" },
    },
    repository: {
      owner: { login: "usekaneo" },
      name: "kaneo",
      full_name: "usekaneo/kaneo",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedValues.length = 0;
  delete process.env.GITHUB_APP_NAME;
  mocks.mockGetGithubApp.mockReturnValue(mocks.mockGithubApp);
  mocks.mockFindAllIntegrationsByRepo.mockResolvedValue([integration]);
  mocks.mockFindExternalLink.mockResolvedValue(null);
  mocks.mockClaimTaskNumber.mockResolvedValue(7);
  mocks.mockResolveTargetStatus.mockResolvedValue("to-do");
  mocks.mockColumnFindFirst.mockResolvedValue(null);
  mocks.mockProjectFindFirst.mockResolvedValue({
    id: "project-1",
    workspaceId: "workspace-1",
    slug: "kaneo",
  });
  mocks.mockGetInstallationOctokit.mockResolvedValue(mocks.mockOctokit);
  mocks.mockCreateExternalLink.mockResolvedValue({ id: "link-1" });
  mocks.mockAddLabelsToIssue.mockResolvedValue(undefined);
  mocks.mockCreateComment.mockResolvedValue({});
});

describe("handleIssueOpened", () => {
  it("persists a valid default priority when the issue has no priority: label", async () => {
    await handleIssueOpened(issueOpenedPayload(["type:bug"]));

    expect(mocks.insertedValues).toHaveLength(1);
    const priority = mocks.insertedValues[0].priority;
    expect(priority).not.toBeNull();
    expect(priority).toBe("low");
  });

  it("persists the extracted priority label when present", async () => {
    await handleIssueOpened(issueOpenedPayload(["type:bug", "priority:high"]));

    expect(mocks.insertedValues).toHaveLength(1);
    expect(mocks.insertedValues[0].priority).toBe("high");
  });
});
