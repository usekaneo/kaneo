import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGitlabWebhookRequest } from "../../../../apps/api/src/plugins/gitlab/webhook-handler";

const mocks = vi.hoisted(() => ({
  integrationFindFirst: vi.fn(),
  handleGitlabMergeRequestOpened: vi.fn(),
  handleGitlabMergeRequestClosed: vi.fn(),
  handleGitlabIssueUpdated: vi.fn(),
  handleGitlabIssueClosed: vi.fn(),
}));

vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-updated",
  () => ({
    handleGitlabIssueUpdated: (...args: unknown[]) =>
      mocks.handleGitlabIssueUpdated(...args),
  }),
);

vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-closed",
  () => ({
    handleGitlabIssueClosed: (...args: unknown[]) =>
      mocks.handleGitlabIssueClosed(...args),
  }),
);

vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      integrationTable: {
        findFirst: (...args: unknown[]) => mocks.integrationFindFirst(...args),
      },
    },
  },
}));

vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-opened",
  () => ({
    handleGitlabMergeRequestOpened: (...args: unknown[]) =>
      mocks.handleGitlabMergeRequestOpened(...args),
  }),
);

vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed",
  () => ({
    handleGitlabMergeRequestClosed: (...args: unknown[]) =>
      mocks.handleGitlabMergeRequestClosed(...args),
  }),
);

const secret = "webhook-secret";

function mergeRequestUpdate(changes: Record<string, unknown>) {
  return JSON.stringify({
    object_kind: "merge_request",
    object_attributes: {
      iid: 1,
      title: "Fix the Safari login button",
      description: null,
      url: "https://gitlab.com/acme/web/-/merge_requests/1",
      state: "opened",
      action: "update",
      source_branch: "kan-1",
    },
    changes,
    project: {
      name: "web",
      web_url: "https://gitlab.com/acme/web",
      path_with_namespace: "acme/web",
    },
  });
}

function mergeRequestOpen(draft: boolean) {
  return JSON.stringify({
    object_kind: "merge_request",
    object_attributes: {
      iid: 2,
      title: "Draft: Rework the checkout form",
      description: null,
      url: "https://gitlab.com/acme/web/-/merge_requests/2",
      state: "opened",
      action: "open",
      draft,
      source_branch: "kan-2",
    },
    project: {
      name: "web",
      web_url: "https://gitlab.com/acme/web",
      path_with_namespace: "acme/web",
    },
  });
}

function issueEvent({
  action,
  eventType = "issue",
  confidential = false,
}: {
  action: string;
  eventType?: string;
  confidential?: boolean;
}) {
  return JSON.stringify({
    object_kind: "issue",
    event_type: eventType,
    object_attributes: {
      iid: 7,
      title: "Payment provider keys",
      description: "internal details",
      url: "https://gitlab.com/acme/web/-/issues/7",
      action,
      confidential,
    },
    changes: { title: { previous: "Old", current: "Payment provider keys" } },
    project: {
      name: "web",
      web_url: "https://gitlab.com/acme/web",
      path_with_namespace: "acme/web",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    type: "gitlab",
    config: JSON.stringify({ webhookSecret: secret }),
  });
});

describe("handleGitlabWebhookRequest merge request opened", () => {
  it("links a draft merge request without moving the task", async () => {
    await handleGitlabWebhookRequest(
      "integration-1",
      mergeRequestOpen(true),
      secret,
    );

    expect(mocks.handleGitlabMergeRequestOpened).toHaveBeenCalledWith(
      expect.anything(),
      "integration-1",
      { moveTask: false },
    );
  });

  it("moves the task when a merge request is opened ready for review", async () => {
    await handleGitlabWebhookRequest(
      "integration-1",
      mergeRequestOpen(false),
      secret,
    );

    expect(mocks.handleGitlabMergeRequestOpened).toHaveBeenCalledWith(
      expect.anything(),
      "integration-1",
      { moveTask: true },
    );
  });
});

describe("handleGitlabWebhookRequest merge request updates", () => {
  it("refreshes the link without moving the task when a merge request becomes a draft", async () => {
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      mergeRequestUpdate({ draft: { previous: false, current: true } }),
      secret,
    );

    expect(result.success).toBe(true);
    expect(mocks.handleGitlabMergeRequestOpened).toHaveBeenCalledWith(
      expect.anything(),
      "integration-1",
      { moveTask: false },
    );
  });

  it("moves the task when a merge request is taken out of draft", async () => {
    await handleGitlabWebhookRequest(
      "integration-1",
      mergeRequestUpdate({ draft: { previous: true, current: false } }),
      secret,
    );

    expect(mocks.handleGitlabMergeRequestOpened).toHaveBeenCalledWith(
      expect.anything(),
      "integration-1",
      { moveTask: true },
    );
  });

  it("ignores an update that does not touch the draft flag", async () => {
    await handleGitlabWebhookRequest(
      "integration-1",
      mergeRequestUpdate({ title: { previous: "a", current: "b" } }),
      secret,
    );

    expect(mocks.handleGitlabMergeRequestOpened).not.toHaveBeenCalled();
    expect(mocks.handleGitlabMergeRequestClosed).not.toHaveBeenCalled();
  });

  it("rejects a delivery whose token does not match", async () => {
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      mergeRequestUpdate({ draft: { previous: false, current: true } }),
      "wrong-secret",
    );

    expect(result).toEqual({ success: false, error: "Invalid webhook token" });
    expect(mocks.handleGitlabMergeRequestOpened).not.toHaveBeenCalled();
  });
});

describe("handleGitlabWebhookRequest handler failures", () => {
  it("reports a failing handler as a server error without its details", async () => {
    mocks.handleGitlabIssueClosed.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "task_pkey"'),
    );
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);

    const result = await handleGitlabWebhookRequest(
      "integration-1",
      issueEvent({ action: "close" }),
      secret,
    );

    expect(result).toEqual({
      success: false,
      error: "Webhook handler failed",
      status: 500,
    });
  });
});

describe("handleGitlabWebhookRequest confidential issues", () => {
  it("passes a regular issue update to the handler", async () => {
    await handleGitlabWebhookRequest(
      "integration-1",
      issueEvent({ action: "update" }),
      secret,
    );

    expect(mocks.handleGitlabIssueUpdated).toHaveBeenCalledOnce();
  });

  it("drops an update to an issue that was made confidential", async () => {
    const result = await handleGitlabWebhookRequest(
      "integration-1",
      issueEvent({
        action: "update",
        eventType: "confidential_issue",
        confidential: true,
      }),
      secret,
    );

    expect(result.success).toBe(true);
    expect(mocks.handleGitlabIssueUpdated).not.toHaveBeenCalled();
  });

  it("drops a confidential issue even without the event type", async () => {
    await handleGitlabWebhookRequest(
      "integration-1",
      issueEvent({ action: "close", confidential: true }),
      secret,
    );

    expect(mocks.handleGitlabIssueClosed).not.toHaveBeenCalled();
  });
});
