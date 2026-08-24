import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  integrationFindFirst: vi.fn(),
  findExternalLink: vi.fn(),
  createExternalLink: vi.fn(),
  findTaskByNumber: vi.fn(),
  publishEvent: vi.fn(),
  listIssues: vi.fn(),
  listMergeRequests: vi.fn(),
  listLabels: vi.fn(),
  listIssueNotes: vi.fn(),
  insertedTasks: [] as Array<Record<string, unknown>>,
  insertedRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      projectTable: {
        findFirst: (...a: unknown[]) => mocks.projectFindFirst(...a),
      },
      integrationTable: {
        findFirst: (...a: unknown[]) => mocks.integrationFindFirst(...a),
      },
      labelTable: { findMany: async () => [], findFirst: async () => null },
    },
    transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => {
              const rows: Array<Record<string, unknown>> = [
                { id: "project-1", workspaceId: "ws-1" },
              ];
              return Object.assign(rows, {
                for: async () => rows,
              });
            },
          }),
        }),
        insert: () => ({
          values: (values: Record<string, unknown>) => {
            mocks.insertedTasks.push(values);
            return {
              returning: async () => [{ id: "task-1", ...values }],
            };
          },
        }),
      }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.insertedRows.push(values);
        return {
          onConflictDoNothing: () => ({ target: [] }),
        };
      },
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
    delete: () => ({ where: async () => undefined }),
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock("../../../apps/api/src/plugins/github/services/link-manager", () => ({
  createExternalLink: (...a: unknown[]) => mocks.createExternalLink(...a),
  findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
}));

vi.mock("../../../apps/api/src/plugins/github/services/task-service", () => ({
  findTaskByNumber: (...a: unknown[]) => mocks.findTaskByNumber(...a),
}));

vi.mock("../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    listIssues: (...a: unknown[]) => mocks.listIssues(...a),
    listMergeRequests: (...a: unknown[]) => mocks.listMergeRequests(...a),
    listLabels: (...a: unknown[]) => mocks.listLabels(...a),
    listIssueNotes: (...a: unknown[]) => mocks.listIssueNotes(...a),
  }),
}));

const { importGitlabIssues } = await import(
  "../../../apps/api/src/gitlab-integration/controllers/import-gitlab-issues"
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.insertedTasks.length = 0;
  mocks.insertedRows.length = 0;
  mocks.projectFindFirst.mockResolvedValue({
    id: "project-1",
    workspaceId: "ws-1",
    slug: "kan",
  });
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    isActive: true,
    config: JSON.stringify({
      baseUrl: "https://gitlab.example.com",
      accessToken: "token",
      repositoryPath: "group/project",
    }),
  });
  mocks.findExternalLink.mockResolvedValue(null);
  mocks.createExternalLink.mockResolvedValue({ id: "link-1" });
  mocks.findTaskByNumber.mockResolvedValue(null);
  mocks.publishEvent.mockResolvedValue(undefined);
  mocks.listLabels.mockResolvedValue([]);
  mocks.listIssueNotes.mockResolvedValue([]);
  mocks.listMergeRequests.mockResolvedValue([]);
});

describe("importGitlabIssues", () => {
  it("imports an open issue with no existing link as a new task", async () => {
    mocks.listIssues.mockResolvedValueOnce([
      {
        id: 1,
        iid: 5,
        title: "Fix login bug",
        description: "Steps to reproduce",
        web_url: "https://gitlab.example.com/group/project/-/issues/5",
        state: "opened",
        labels: [],
        author: { username: "octocat" },
      },
    ]);
    mocks.listIssues.mockResolvedValueOnce([]);

    const result = await importGitlabIssues("project-1");

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mocks.createExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "issue",
        externalId: "5",
        url: "https://gitlab.example.com/group/project/-/issues/5",
      }),
    );
  });

  it("skips an issue that already has an external link and reports it as updated", async () => {
    mocks.findExternalLink.mockResolvedValueOnce({ taskId: "task-existing" });
    mocks.listIssues.mockResolvedValueOnce([
      {
        id: 1,
        iid: 5,
        title: "Fix login bug",
        description: "",
        web_url: "https://gitlab.example.com/group/project/-/issues/5",
        state: "opened",
        labels: [],
        author: { username: "octocat" },
      },
    ]);
    mocks.listIssues.mockResolvedValueOnce([]);

    const result = await importGitlabIssues("project-1");

    expect(result.updated).toBe(1);
    expect(result.imported).toBe(0);
    expect(mocks.createExternalLink).not.toHaveBeenCalled();
  });

  it("resolves a labeled issue's label color from the project's listLabels call", async () => {
    mocks.listLabels.mockResolvedValueOnce([
      { id: 1, name: "bug", color: "#FF0000" },
    ]);
    mocks.listIssues.mockResolvedValueOnce([
      {
        id: 2,
        iid: 6,
        title: "Crash on save",
        description: "",
        web_url: "https://gitlab.example.com/group/project/-/issues/6",
        state: "opened",
        labels: ["bug"],
        author: { username: "octocat" },
      },
    ]);

    const result = await importGitlabIssues("project-1");

    expect(result.imported).toBe(1);
    const labelRow = mocks.insertedRows.find((row) => row.name === "bug");
    expect(labelRow).toBeDefined();
    expect(labelRow?.color).toBe("#FF0000");
  });

  it("links a merge request whose branch resolves a task number to that task", async () => {
    mocks.listIssues.mockResolvedValueOnce([]);
    mocks.findTaskByNumber.mockResolvedValueOnce({
      id: "task-mr-1",
      projectId: "project-1",
      number: 7,
    });
    mocks.listMergeRequests.mockResolvedValueOnce([
      {
        iid: 9,
        title: "Add feature",
        description: null,
        web_url: "https://gitlab.example.com/group/project/-/merge_requests/9",
        state: "opened",
        source_branch: "kan-7",
        author: { username: "dev1" },
      },
    ]);

    const result = await importGitlabIssues("project-1");

    expect(result.errors).toBeUndefined();
    expect(mocks.createExternalLink).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "pull_request",
        externalId: "9",
        taskId: "task-mr-1",
      }),
    );
  });

  it("skips a merge request whose branch resolves a task number with no matching task", async () => {
    mocks.listIssues.mockResolvedValueOnce([]);
    mocks.findTaskByNumber.mockResolvedValueOnce(null);
    mocks.listMergeRequests.mockResolvedValueOnce([
      {
        iid: 10,
        title: "Unrelated change",
        description: null,
        web_url: "https://gitlab.example.com/group/project/-/merge_requests/10",
        state: "opened",
        source_branch: "kan-99",
        author: { username: "dev1" },
      },
    ]);

    const result = await importGitlabIssues("project-1");

    expect(result.errors).toBeUndefined();
    expect(mocks.createExternalLink).not.toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "pull_request" }),
    );
  });
});
