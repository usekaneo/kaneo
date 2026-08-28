import { beforeEach, describe, expect, it, vi } from "vitest";

// Event/action pairs and header names below were captured from a live GitLab CE
// instance; the dispatcher discriminates on the body's object_kind because the
// X-Gitlab-Event header only carries a display name ("Issue Hook").
const mocks = vi.hoisted(() => ({
  integrationFindFirst: vi.fn(),
  push: vi.fn(),
  mrOpened: vi.fn(),
  mrClosed: vi.fn(),
  mrUpdated: vi.fn(),
  issueOpened: vi.fn(),
  issueClosed: vi.fn(),
  issueReopened: vi.fn(),
  issueUpdated: vi.fn(),
  noteCreated: vi.fn(),
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

vi.mock("../../../../apps/api/src/plugins/gitlab/webhooks/push", () => ({
  handleGitlabPush: (...args: unknown[]) => mocks.push(...args),
}));
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-opened",
  () => ({
    handleGitlabMergeRequestOpened: (...args: unknown[]) =>
      mocks.mrOpened(...args),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed",
  () => ({
    handleGitlabMergeRequestClosed: (...args: unknown[]) =>
      mocks.mrClosed(...args),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/merge-request-updated",
  () => ({
    handleGitlabMergeRequestUpdated: (...args: unknown[]) =>
      mocks.mrUpdated(...args),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-opened",
  () => ({
    handleGitlabIssueOpened: (...args: unknown[]) => mocks.issueOpened(...args),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-state-changed",
  () => ({
    handleGitlabIssueClosed: (...args: unknown[]) => mocks.issueClosed(...args),
    handleGitlabIssueReopened: (...args: unknown[]) =>
      mocks.issueReopened(...args),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/issue-updated",
  () => ({
    handleGitlabIssueUpdated: (...args: unknown[]) =>
      mocks.issueUpdated(...args),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitlab/webhooks/note-created",
  () => ({
    handleGitlabNoteCreated: (...args: unknown[]) => mocks.noteCreated(...args),
  }),
);

const { handleGitlabWebhookRequest } = await import(
  "../../../../apps/api/src/plugins/gitlab/webhook-handler"
);

const SECRET = "kaneo-webhook-secret";

const project = {
  id: 1,
  name: "my-app",
  web_url: "http://gitlab.example/acme/platform/my-app",
  path_with_namespace: "acme/platform/my-app",
};

function body(payload: Record<string, unknown>) {
  return JSON.stringify({ project, ...payload });
}

function send(payload: Record<string, unknown>, token = SECRET) {
  return handleGitlabWebhookRequest(
    "integration-1",
    body(payload),
    token,
    "Issue Hook",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    type: "gitlab",
    config: JSON.stringify({ webhookSecret: SECRET }),
  });
});

describe("handleGitlabWebhookRequest", () => {
  it("rejects a request whose X-Gitlab-Token does not match", async () => {
    await expect(
      send({ object_kind: "push", ref: "refs/heads/x" }, "nope"),
    ).resolves.toEqual({ success: false, error: "Invalid webhook token" });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("rejects a missing token rather than trusting the body", async () => {
    await expect(
      handleGitlabWebhookRequest(
        "integration-1",
        body({}),
        undefined,
        "Push Hook",
      ),
    ).resolves.toEqual({ success: false, error: "Invalid webhook token" });
  });

  it("refuses an integration id that is not a GitLab integration", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "integration-1",
      type: "gitea",
      config: "{}",
    });

    await expect(
      send({ object_kind: "push", ref: "refs/heads/x" }),
    ).resolves.toEqual({
      success: false,
      error: "GitLab integration not found",
    });
  });

  it("routes a push", async () => {
    await expect(
      send({ object_kind: "push", ref: "refs/heads/my-app-1", commits: [] }),
    ).resolves.toEqual({ success: true });
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["open", "issueOpened"],
    ["close", "issueClosed"],
    ["reopen", "issueReopened"],
    ["update", "issueUpdated"],
  ] as const)("routes issue action %s", async (action, handler) => {
    await expect(
      send({ object_kind: "issue", object_attributes: { iid: 1, action } }),
    ).resolves.toEqual({ success: true });
    expect(mocks[handler]).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["open", "mrOpened"],
    ["reopen", "mrOpened"],
    ["close", "mrClosed"],
    ["merge", "mrClosed"],
    ["update", "mrUpdated"],
  ] as const)("routes merge request action %s", async (action, handler) => {
    await expect(
      send({
        object_kind: "merge_request",
        object_attributes: { iid: 1, action },
      }),
    ).resolves.toEqual({ success: true });
    expect(mocks[handler]).toHaveBeenCalledTimes(1);
  });

  it("routes a note", async () => {
    await expect(
      send({
        object_kind: "note",
        object_attributes: { id: 1, note: "hi", noteable_type: "Issue" },
        issue: { iid: 1 },
      }),
    ).resolves.toEqual({ success: true });
    expect(mocks.noteCreated).toHaveBeenCalledTimes(1);
  });

  it("ignores an event kind it does not handle", async () => {
    await expect(send({ object_kind: "pipeline" })).resolves.toEqual({
      success: true,
    });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.issueOpened).not.toHaveBeenCalled();
  });

  it("reports invalid JSON instead of throwing", async () => {
    await expect(
      handleGitlabWebhookRequest("integration-1", "{oops", SECRET, "Push Hook"),
    ).resolves.toEqual({ success: false, error: "Invalid JSON payload" });
  });
});
