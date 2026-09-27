import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { importGiteaIssues } from "../../../../apps/api/src/gitea-integration/controllers/import-gitea-issues";
import { handleTaskCommentCreated } from "../../../../apps/api/src/plugins/gitea/events/task-comment-created";
import { handleGiteaIssueCommentCreated } from "../../../../apps/api/src/plugins/gitea/webhooks/issue-comment-created";

const mocks = vi.hoisted(() => ({
  values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })),
  createIssueComment: vi.fn(),
  listIssueComments: vi.fn(),
}));
const config = {
  baseUrl: "https://gitea.example.com",
  accessToken: "test-token",
  repositoryOwner: "owner",
  repositoryName: "repo",
};

vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    insert: () => ({ values: mocks.values }),
    update: () => ({ set: () => ({ where: vi.fn() }) }),
    delete: () => ({ where: vi.fn() }),
    query: {
      projectTable: { findFirst: async () => ({ workspaceId: "workspace-1" }) },
      integrationTable: {
        findFirst: async () => ({
          id: "integration-1",
          isActive: true,
          config: JSON.stringify(config),
        }),
      },
      labelTable: { findMany: async () => [] },
    },
  },
}));
vi.mock("../../../../apps/api/src/events", () => ({ publishEvent: vi.fn() }));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLinkByTaskAndType: async () => ({ externalId: "42" }),
    findExternalLink: async () => ({ taskId: "task-1" }),
    createExternalLink: vi.fn(),
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/gitea/services/integration-lookup",
  () => ({
    findAllIntegrationsByGiteaRepo: async () => [{ id: "integration-1" }],
    repoOwnerLogin: () => "owner",
  }),
);
vi.mock("../../../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    createIssueComment: mocks.createIssueComment,
    listIssueComments: mocks.listIssueComments,
    listIssues: async () => [
      { number: 42, title: "Issue", body: "", labels: [] },
    ],
    listPulls: async () => [],
  }),
}));

function comment(body: string, id = 1) {
  return {
    id,
    body,
    html_url: `https://gitea.example.com/owner/repo/issues/42#issuecomment-${id}`,
    user: { login: "regular-user", avatar_url: "" },
    created_at: "2026-09-27T00:00:00Z",
  };
}

async function deliverWebhook(body: string) {
  await handleGiteaIssueCommentCreated({
    action: "created",
    issue: { number: 42 },
    comment: comment(body),
    repository: {
      owner: { login: "owner" },
      name: "repo",
      html_url: "https://gitea.example.com/owner/repo",
    },
  });
}

async function outboundBody(comment = "A comment from Kaneo") {
  await handleTaskCommentCreated(
    {
      taskId: "task-1",
      projectId: "project-1",
      userId: "user-1",
      comment,
    },
    { integrationId: "integration-1", projectId: "project-1", config },
  );
  expect(mocks.createIssueComment).toHaveBeenCalledWith(
    "owner",
    "repo",
    42,
    expect.stringContaining(comment),
  );
  return mocks.createIssueComment.mock.calls[0][3] as string;
}

beforeEach(() => vi.clearAllMocks());

describe("Gitea comment sync", () => {
  it("does not reimport outbound comments through repeated personal-token webhooks", async () => {
    const body = await outboundBody();
    await deliverWebhook(body);
    await deliverWebhook(`${body}\n`);
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("puts the hidden marker before unclosed Markdown code fences", async () => {
    const body = await outboundBody("```ts\nconst example = 1;");
    expect(body).toBe("<!-- kaneo:comment -->\n\n```ts\nconst example = 1;");
    await deliverWebhook(body);
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it.each([
    "Discussing the marker: <!-- kaneo:comment -->",
    "> <!-- kaneo:comment -->\n\nQuoted marker",
    "```html\n<!-- kaneo:comment -->\n```",
  ])(
    "imports native comments discussing or quoting the marker: %s",
    async (body) => {
      await deliverWebhook(body);
      expect(mocks.values).toHaveBeenCalledWith(
        expect.objectContaining({ content: body }),
      );
      mocks.values.mockClear();
      mocks.listIssueComments.mockResolvedValue([comment(body)]);
      await importGiteaIssues("project-1");
      expect(mocks.values).toHaveBeenCalledWith(
        expect.objectContaining({ content: body }),
      );
    },
  );

  it("still imports native Gitea comments from the same personal-token user", async () => {
    await deliverWebhook("A comment written in Gitea");
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "A comment written in Gitea",
        externalUserName: "regular-user",
        externalSource: "gitea",
      }),
    );
  });

  it("skips outbound comments during bulk import while preserving native comments", async () => {
    const body = await outboundBody();
    mocks.listIssueComments.mockResolvedValue([
      comment(`${body}\nAn edit appended in Gitea`),
      comment("Native comment", 2),
    ]);
    const result = await importGiteaIssues("project-1");
    expect(result.errors).toBeUndefined();
    expect(result.updated).toBe(1);
    expect(mocks.values).toHaveBeenCalledTimes(1);
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Native comment" }),
    );
  });
});
