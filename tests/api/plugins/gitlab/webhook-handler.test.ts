import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGitlabWebhookRequest } from "../../../../apps/api/src/plugins/gitlab/webhook-handler";

const mocks = vi.hoisted(() => ({
  integrationFindFirst: vi.fn(),
  handleGitlabMergeRequestOpened: vi.fn(),
  handleGitlabMergeRequestClosed: vi.fn(),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    type: "gitlab",
    config: JSON.stringify({ webhookSecret: secret }),
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
