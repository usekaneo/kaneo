import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listIssues: vi.fn(),
  deleteLabels: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      projectTable: {
        findFirst: async () => ({
          id: "project-1",
          slug: "kan",
          workspaceId: "workspace-1",
        }),
      },
      integrationTable: {
        findFirst: async () => ({
          id: "integration-1",
          isActive: true,
          config: JSON.stringify({
            baseUrl: "https://gitlab.com",
            accessToken: "token",
            projectPath: "acme/web",
          }),
        }),
      },
      labelTable: {
        findMany: async () => [],
        findFirst: async () => undefined,
      },
    },
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    delete: (...args: unknown[]) => {
      mocks.deleteLabels(...args);
      return { where: async () => undefined };
    },
    insert: () => ({
      values: (values: unknown) => {
        mocks.insertValues(values);
        return { onConflictDoNothing: async () => undefined };
      },
    }),
  },
}));

vi.mock("../../../apps/api/src/plugins/github/services/link-manager", () => ({
  findExternalLink: async () => ({ id: "link-1", taskId: "task-1" }),
  createExternalLink: vi.fn(),
}));

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    listIssues: (...args: unknown[]) => mocks.listIssues(...args),
    listIssueNotes: async () => [],
    listMergeRequests: async () => [],
  }),
}));

const { importGitlabIssues } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/import-gitlab-issues"
);

function linkedIssue(labels: string[]) {
  return {
    iid: 3,
    title: "Checkout button overlaps the footer",
    description: null,
    state: "opened",
    web_url: "https://gitlab.com/acme/web/-/issues/3",
    labels,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("importGitlabIssues labels on an already linked task", () => {
  it("keeps task labels when the GitLab issue has none", async () => {
    mocks.listIssues.mockResolvedValueOnce([linkedIssue([])]);

    const result = await importGitlabIssues("project-1");

    expect(result.updated).toBe(1);
    expect(mocks.deleteLabels).not.toHaveBeenCalled();
  });

  it("adds GitLab labels without removing the ones set in Kaneo", async () => {
    mocks.listIssues.mockResolvedValueOnce([
      linkedIssue(["bug", "priority:high"]),
    ]);

    await importGitlabIssues("project-1");

    expect(mocks.deleteLabels).not.toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ name: "bug", taskId: "task-1" }),
    );
    expect(mocks.insertValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "priority:high" }),
    );
  });
});
