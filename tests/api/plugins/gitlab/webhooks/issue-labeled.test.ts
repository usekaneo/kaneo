import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllIntegrationsByGitlabProject: vi.fn(),
  findExternalLink: vi.fn(),
  updateTaskStatus: vi.fn(),
  publishEvent: vi.fn(),
  taskFindFirst: vi.fn(),
  labelFindFirst: vi.fn(),
  labelFindMany: vi.fn(),
  insertedLabels: [] as Array<Record<string, unknown>>,
  deletedLabelIds: [] as string[],
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      taskTable: { findFirst: (...a: unknown[]) => mocks.taskFindFirst(...a) },
      labelTable: {
        findFirst: (...a: unknown[]) => mocks.labelFindFirst(...a),
        findMany: (...a: unknown[]) => mocks.labelFindMany(...a),
      },
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.insertedLabels.push(values);
        return { onConflictDoNothing: () => undefined };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    delete: () => ({
      where: (cond: { id?: string }) => {
        mocks.deletedLabelIds.push(String(cond));
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock("../../../../../apps/api/src/events", () => ({
  publishEvent: (...a: unknown[]) => mocks.publishEvent(...a),
}));

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLink: (...a: unknown[]) => mocks.findExternalLink(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/github/services/task-service",
  () => ({
    updateTaskStatus: (...a: unknown[]) => mocks.updateTaskStatus(...a),
  }),
);

vi.mock(
  "../../../../../apps/api/src/plugins/gitlab/services/integration-lookup",
  () => ({
    findAllIntegrationsByGitlabProject: (...a: unknown[]) =>
      mocks.findAllIntegrationsByGitlabProject(...a),
  }),
);

const { handleGitlabIssueLabeled } = await import(
  "../../../../../apps/api/src/plugins/gitlab/webhooks/issue-labeled"
);

const integration = { id: "integration-1", projectId: "project-1" };

function labeledPayload(
  previous: Array<{ title: string; color?: string }>,
  current: Array<{ title: string; color?: string }>,
) {
  return {
    object_attributes: { iid: 42, action: "update" },
    changes: { labels: { previous, current } },
    project: {
      path_with_namespace: "group/project",
      web_url: "https://gitlab.example.com/group/project",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertedLabels.length = 0;
  mocks.deletedLabelIds.length = 0;
  mocks.findAllIntegrationsByGitlabProject.mockResolvedValue([integration]);
  mocks.findExternalLink.mockResolvedValue({ taskId: "task-1" });
  mocks.taskFindFirst.mockResolvedValue({
    id: "task-1",
    project: { workspaceId: "ws-1" },
  });
  mocks.labelFindFirst.mockResolvedValue(null);
  mocks.labelFindMany.mockResolvedValue([]);
});

describe("handleGitlabIssueLabeled", () => {
  it("inserts a newly added non-system label", async () => {
    await handleGitlabIssueLabeled(
      labeledPayload([], [{ title: "bug", color: "#FF0000" }]),
    );

    expect(mocks.insertedLabels).toHaveLength(1);
    expect(mocks.insertedLabels[0]).toMatchObject({
      name: "bug",
      color: "#FF0000",
      taskId: "task-1",
      workspaceId: "ws-1",
    });
  });

  it("does not treat a priority: label as a syncable label", async () => {
    await handleGitlabIssueLabeled(
      labeledPayload([], [{ title: "priority:high" }]),
    );

    expect(mocks.insertedLabels).toHaveLength(0);
  });

  it("ignores an unchanged label set", async () => {
    await handleGitlabIssueLabeled(
      labeledPayload(
        [{ title: "bug", color: "#FF0000" }],
        [{ title: "bug", color: "#FF0000" }],
      ),
    );

    expect(mocks.insertedLabels).toHaveLength(0);
  });
});
