import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindAllIntegrationsByRepo = vi.fn();
const mockFindTaskByNumber = vi.fn();
const mockIsTaskInFinalState = vi.fn();
const mockUpdateTaskStatus = vi.fn();
const mockCreateOrUpdateExternalLink = vi.fn();
const mockResolveTargetStatus = vi.fn();
const mockPublishEvent = vi.fn();

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    findAllIntegrationsByRepo: (...args: unknown[]) =>
      mockFindAllIntegrationsByRepo(...args),
    findTaskByNumber: (...args: unknown[]) => mockFindTaskByNumber(...args),
    isTaskInFinalState: (...args: unknown[]) => mockIsTaskInFinalState(...args),
    updateTaskStatus: (...args: unknown[]) => mockUpdateTaskStatus(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    createOrUpdateExternalLink: (...args: unknown[]) =>
      mockCreateOrUpdateExternalLink(...args),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/utils/resolve-column",
  () => ({
    resolveTargetStatus: (...args: unknown[]) =>
      mockResolveTargetStatus(...args),
  }),
);

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

import { handlePush } from "../../../../../apps/api/src/plugins/github/webhooks/push";

const repository = {
  owner: { login: "usekaneo" },
  name: "kaneo",
  html_url: "https://github.com/usekaneo/kaneo",
};

const head_commit = {
  id: "abc123",
  message: "chore: release",
  author: { name: "Jane" },
  timestamp: "2024-01-01T00:00:00Z",
};

function makeIntegration(config: Record<string, unknown> = {}) {
  return {
    id: "integration-1",
    projectId: "project-1",
    project: { slug: "KAN" },
    config: JSON.stringify({
      repositoryOwner: "usekaneo",
      repositoryName: "kaneo",
      installationId: 1,
      branchPattern: "{slug}-{number}",
      ...config,
    }),
  };
}

const task = {
  id: "task-1",
  projectId: "project-1",
  number: 42,
  status: "to-do",
  columnId: null,
  title: "Ship it",
  userId: "user-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});

  mockFindAllIntegrationsByRepo.mockResolvedValue([makeIntegration()]);
  mockFindTaskByNumber.mockResolvedValue(task);
  mockIsTaskInFinalState.mockResolvedValue(false);
  mockResolveTargetStatus.mockResolvedValue("in-progress");
  mockUpdateTaskStatus.mockResolvedValue({
    applied: true,
    before: task,
    after: { ...task, status: "in-progress" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handlePush ref filtering", () => {
  const nonBranchRefs = [
    "refs/tags/v1.0",
    "refs/tags/v2.3.4",
    "refs/pull/12/merge",
    "refs/notes/commits",
  ];

  for (const ref of nonBranchRefs) {
    it(`returns early for the non-branch ref ${ref}`, async () => {
      await handlePush({ ref, repository, head_commit });

      expect(mockFindAllIntegrationsByRepo).not.toHaveBeenCalled();
      expect(mockFindTaskByNumber).not.toHaveBeenCalled();
      expect(mockCreateOrUpdateExternalLink).not.toHaveBeenCalled();
      expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
    });
  }

  it("leaves a task untouched when a tag matches an unanchored custom regex", async () => {
    mockFindAllIntegrationsByRepo.mockResolvedValue([
      makeIntegration({ customBranchRegex: "kan-(\\d+)" }),
    ]);

    await handlePush({ ref: "refs/tags/kan-42", repository, head_commit });

    expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
    expect(mockPublishEvent).not.toHaveBeenCalled();
    expect(mockFindAllIntegrationsByRepo).not.toHaveBeenCalled();
  });
});

describe("handlePush branch handling", () => {
  it("looks up integrations for a branch push", async () => {
    await handlePush({
      ref: "refs/heads/feature-x",
      repository,
      head_commit,
    });

    expect(mockFindAllIntegrationsByRepo).toHaveBeenCalledWith(
      "usekaneo",
      "kaneo",
    );
  });

  it("strips the ref prefix before matching and linking a task", async () => {
    await handlePush({ ref: "refs/heads/kan-42", repository, head_commit });

    expect(mockFindTaskByNumber).toHaveBeenCalledWith("project-1", 42);
    expect(mockCreateOrUpdateExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        externalId: "kan-42",
        title: "kan-42",
        url: "https://github.com/usekaneo/kaneo/tree/kan-42",
      }),
    );
    expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", "in-progress");
  });

  it("skips a protected branch", async () => {
    await handlePush({ ref: "refs/heads/main", repository, head_commit });

    expect(mockFindAllIntegrationsByRepo).not.toHaveBeenCalled();
    expect(mockUpdateTaskStatus).not.toHaveBeenCalled();
  });
});
