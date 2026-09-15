import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  issueLink: vi.fn(),
  updateExternalLink: vi.fn(),
  updateIssue: vi.fn(),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLinksByTask: async () => [mocks.issueLink()],
    updateExternalLink: (...args: unknown[]) =>
      mocks.updateExternalLink(...args),
  }),
);

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    updateIssue: (...args: unknown[]) => mocks.updateIssue(...args),
  }),
}));

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  updateIssueLabelsGitlab: async () => undefined,
}));

const { handleTaskStatusChanged } = await import(
  "../../../../../apps/api/src/plugins/gitlab/events/task-status-changed"
);

const context = {
  integrationId: "integration-1",
  projectId: "project-1",
  config: {
    baseUrl: "https://gitlab.com",
    accessToken: "token",
    projectPath: "acme/web",
  },
};

function closeTask() {
  return handleTaskStatusChanged(
    {
      taskId: "task-1",
      projectId: "project-1",
      userId: "user-1",
      oldStatus: "in-review",
      newStatus: "done",
      title: "Checkout button overlaps the footer",
    },
    context,
  );
}

function linkWithMetadata(metadata: string | null) {
  return {
    id: "link-1",
    integrationId: "integration-1",
    resourceType: "issue",
    externalId: "3",
    metadata,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleTaskStatusChanged link metadata", () => {
  it("still records the outbound close when stored metadata is malformed", async () => {
    mocks.issueLink.mockReturnValue(linkWithMetadata("{not json"));

    await closeTask();

    expect(mocks.updateIssue).toHaveBeenCalledOnce();
    expect(mocks.updateExternalLink).toHaveBeenCalledWith("link-1", {
      metadata: expect.objectContaining({
        state: "closed",
        lastOutboundStateSyncAt: expect.any(Number),
      }),
    });
  });

  it("does not spread an array stored as metadata", async () => {
    mocks.issueLink.mockReturnValue(linkWithMetadata('["a","b"]'));

    await closeTask();

    expect(mocks.updateExternalLink).toHaveBeenCalledOnce();
    const [, update] = mocks.updateExternalLink.mock.calls[0] as [
      string,
      { metadata: Record<string, unknown> },
    ];
    expect(Object.keys(update.metadata).sort()).toEqual([
      "lastOutboundStateSyncAt",
      "state",
    ]);
  });

  it("keeps existing metadata fields", async () => {
    mocks.issueLink.mockReturnValue(
      linkWithMetadata(JSON.stringify({ author: "octocat", state: "opened" })),
    );

    await closeTask();

    expect(mocks.updateExternalLink).toHaveBeenCalledWith("link-1", {
      metadata: expect.objectContaining({ author: "octocat", state: "closed" }),
    });
  });
});
