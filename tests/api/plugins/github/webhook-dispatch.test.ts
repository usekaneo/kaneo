import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlePush: vi.fn(),
  handlePullRequestOpened: vi.fn(),
  handlePullRequestClosed: vi.fn(),
  handleIssueOpened: vi.fn(),
  handleIssueClosed: vi.fn(),
  handleIssueReopened: vi.fn(),
  handleIssueEdited: vi.fn(),
  handleIssueLabeled: vi.fn(),
  handleIssueCommentCreated: vi.fn(),
}));

vi.mock("../../../../apps/api/src/plugins/github/webhooks/push", () => ({
  handlePush: mocks.handlePush,
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/pull-request-opened",
  () => ({ handlePullRequestOpened: mocks.handlePullRequestOpened }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/pull-request-closed",
  () => ({ handlePullRequestClosed: mocks.handlePullRequestClosed }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/issue-opened",
  () => ({
    handleIssueOpened: mocks.handleIssueOpened,
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/issue-closed",
  () => ({
    handleIssueClosed: mocks.handleIssueClosed,
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/issue-reopened",
  () => ({ handleIssueReopened: mocks.handleIssueReopened }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/issue-edited",
  () => ({
    handleIssueEdited: mocks.handleIssueEdited,
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/issue-labeled",
  () => ({ handleIssueLabeled: mocks.handleIssueLabeled }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/webhooks/issue-comment-created",
  () => ({ handleIssueCommentCreated: mocks.handleIssueCommentCreated }),
);

const { dispatchGithubEvent } = await import(
  "../../../../apps/api/src/plugins/github/webhook-dispatch"
);

beforeEach(() => vi.clearAllMocks());

describe("dispatchGithubEvent", () => {
  it("routes push", async () => {
    await dispatchGithubEvent("push", { ref: "refs/heads/x" });
    expect(mocks.handlePush).toHaveBeenCalledTimes(1);
  });

  it("routes pull_request opened/reopened vs closed", async () => {
    await dispatchGithubEvent("pull_request", { action: "opened" });
    await dispatchGithubEvent("pull_request", { action: "reopened" });
    expect(mocks.handlePullRequestOpened).toHaveBeenCalledTimes(2);

    await dispatchGithubEvent("pull_request", { action: "closed" });
    expect(mocks.handlePullRequestClosed).toHaveBeenCalledTimes(1);
  });

  it("routes each issues action", async () => {
    await dispatchGithubEvent("issues", { action: "opened" });
    await dispatchGithubEvent("issues", { action: "closed" });
    await dispatchGithubEvent("issues", { action: "reopened" });
    await dispatchGithubEvent("issues", { action: "edited" });
    await dispatchGithubEvent("issues", { action: "labeled" });
    await dispatchGithubEvent("issues", { action: "unlabeled" });

    expect(mocks.handleIssueOpened).toHaveBeenCalledTimes(1);
    expect(mocks.handleIssueClosed).toHaveBeenCalledTimes(1);
    expect(mocks.handleIssueReopened).toHaveBeenCalledTimes(1);
    expect(mocks.handleIssueEdited).toHaveBeenCalledTimes(1);
    expect(mocks.handleIssueLabeled).toHaveBeenCalledTimes(2);
  });

  it("routes issue_comment created only", async () => {
    await dispatchGithubEvent("issue_comment", { action: "created" });
    await dispatchGithubEvent("issue_comment", { action: "deleted" });
    expect(mocks.handleIssueCommentCreated).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown events and actions", async () => {
    await dispatchGithubEvent("ping", {});
    await dispatchGithubEvent("issues", { action: "assigned" });
    expect(mocks.handleIssueOpened).not.toHaveBeenCalled();
    expect(mocks.handlePush).not.toHaveBeenCalled();
  });
});
