import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  integrationFindFirst: vi.fn(),
  handlePush: vi.fn(),
  handleMROpened: vi.fn(),
  handleMRClosed: vi.fn(),
  handleIssueOpened: vi.fn(),
  handleIssueClosed: vi.fn(),
  handleIssueReopened: vi.fn(),
  handleIssueEdited: vi.fn(),
  handleIssueLabeled: vi.fn(),
  handleIssueComment: vi.fn(),
}));

vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      integrationTable: {
        findFirst: (...a: unknown[]) => mocks.integrationFindFirst(...a),
      },
    },
  },
}));

vi.mock("../../../../apps/api/src/plugins/gitlab/webhooks/push", () => ({
  handleGitlabPush: (...a: unknown[]) => mocks.handlePush(...a),
}));
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-opened",
  () => ({
    handleGitlabMergeRequestOpened: (...a: unknown[]) =>
      mocks.handleMROpened(...a),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed",
  () => ({
    handleGitlabMergeRequestClosed: (...a: unknown[]) =>
      mocks.handleMRClosed(...a),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-opened",
  () => ({
    handleGitlabIssueOpened: (...a: unknown[]) => mocks.handleIssueOpened(...a),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-closed",
  () => ({
    handleGitlabIssueClosed: (...a: unknown[]) => mocks.handleIssueClosed(...a),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-reopened",
  () => ({
    handleGitlabIssueReopened: (...a: unknown[]) =>
      mocks.handleIssueReopened(...a),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-edited",
  () => ({
    handleGitlabIssueEdited: (...a: unknown[]) => mocks.handleIssueEdited(...a),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-labeled",
  () => ({
    handleGitlabIssueLabeled: (...a: unknown[]) =>
      mocks.handleIssueLabeled(...a),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-comment-created",
  () => ({
    handleGitlabIssueCommentCreated: (...a: unknown[]) =>
      mocks.handleIssueComment(...a),
  }),
);

const { handleGitlabWebhookRequest } = await import(
  "../../../../apps/api/src/plugins/gitlab/webhook-handler"
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    type: "gitlab",
    config: JSON.stringify({ webhookSecret: "s3cr3t" }),
  });
});

describe("handleGitlabWebhookRequest", () => {
  it("rejects a request with a wrong token", async () => {
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      JSON.stringify({ object_kind: "push" }),
      "wrong",
      "Push Hook",
    );
    expect(result.success).toBe(false);
    expect(mocks.handlePush).not.toHaveBeenCalled();
  });

  it("dispatches a Push Hook to handleGitlabPush", async () => {
    const body = JSON.stringify({
      object_kind: "push",
      ref: "refs/heads/kan-1",
      project: { path_with_namespace: "g/p", web_url: "https://gl/g/p" },
    });
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      body,
      "s3cr3t",
      "Push Hook",
    );
    expect(result.success).toBe(true);
    expect(mocks.handlePush).toHaveBeenCalledTimes(1);
  });

  it("dispatches an Issue Hook update to both edited and labeled handlers", async () => {
    const body = JSON.stringify({
      object_kind: "issue",
      object_attributes: { iid: 1, action: "update" },
      project: { path_with_namespace: "g/p", web_url: "https://gl/g/p" },
    });
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      body,
      "s3cr3t",
      "Issue Hook",
    );
    expect(result.success).toBe(true);
    expect(mocks.handleIssueEdited).toHaveBeenCalledTimes(1);
    expect(mocks.handleIssueLabeled).toHaveBeenCalledTimes(1);
  });

  it("dispatches a Note Hook to handleGitlabIssueCommentCreated", async () => {
    const body = JSON.stringify({
      object_kind: "note",
      object_attributes: { id: 1, note: "hi", noteable_type: "Issue" },
      issue: { iid: 1 },
      project: { path_with_namespace: "g/p", web_url: "https://gl/g/p" },
    });
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      body,
      "s3cr3t",
      "Note Hook",
    );
    expect(result.success).toBe(true);
    expect(mocks.handleIssueComment).toHaveBeenCalledTimes(1);
  });
});
