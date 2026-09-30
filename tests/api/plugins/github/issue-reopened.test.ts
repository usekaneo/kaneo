import { beforeEach, expect, it, vi } from "vite-plus/test";
import { handleIssueReopened } from "../../../../apps/api/src/plugins/github/webhooks/issue-reopened";

const m = vi.hoisted(() => ({
  links: vi.fn(),
  tasks: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  status: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: { findFirst: m.links },
      taskTable: { findFirst: m.tasks },
      columnTable: { findFirst: async () => undefined },
    },
  },
}));
vi.mock("../../../../apps/api/src/events", () => ({ publishEvent: m.publish }));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/task-service",
  async (original) => ({
    ...(await original<
      typeof import("../../../../apps/api/src/plugins/github/services/task-service")
    >()),
    findAllIntegrationsByRepo: m.find,
    updateTaskStatus: m.status,
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    updateExternalLink: m.update,
  }),
);
vi.mock("../../../../apps/api/src/plugins/github/utils/resolve-column", () => ({
  resolveTargetStatus: async () => "to-do",
}));
const payload = {
  action: "reopened",
  installation: { id: 10 },
  repository: {
    id: 20,
    owner: { login: "example" },
    name: "repo",
    full_name: "example/repo",
  },
  issue: {
    number: 1,
    title: "Issue",
    html_url: "https://github.com/example/repo/issues/1",
    state: "open",
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockResolvedValue([{ id: "integration-1" }, { id: "integration-2" }]);
  m.tasks.mockResolvedValue({ id: "task", projectId: "project" });
  m.status.mockResolvedValue({ applied: false });
});
it.each(["null", "[]", "42", '"text"', "invalid JSON"])(
  "continues through all linked rows when metadata is %s",
  async (metadata) => {
    m.links
      .mockResolvedValueOnce({ id: "first", taskId: "task", metadata })
      .mockResolvedValueOnce({
        id: "second",
        taskId: "task",
        metadata: '{"custom":"keep"}',
      });
    await handleIssueReopened(payload);
    expect(m.find).toHaveBeenCalledWith(payload);
    expect(m.update).toHaveBeenCalledWith(
      "first",
      {
        metadata: expect.objectContaining({ state: "open" }),
      },
      expect.anything(),
    );
    expect(m.update).toHaveBeenCalledWith(
      "second",
      {
        metadata: expect.objectContaining({ custom: "keep", state: "open" }),
      },
      expect.anything(),
    );
    expect(m.status).toHaveBeenCalledTimes(2);
  },
);
it("retains the Kaneo-origin skip rule for valid metadata", async () => {
  m.find.mockResolvedValue([{ id: "integration-1" }]);
  m.links.mockResolvedValue({
    id: "first",
    taskId: "task",
    metadata: '{"createdFrom":"kaneo"}',
  });
  await handleIssueReopened(payload);
  expect(m.update).not.toHaveBeenCalled();
  expect(m.status).not.toHaveBeenCalled();
});

// Ownership locking is covered by integration-task-scope.test.ts. These cases
// exercise provider behavior with the transaction's existing database mock.
vi.mock(
  "../../../../apps/api/src/plugins/github/services/integration-task-scope",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../../apps/api/src/plugins/github/services/integration-task-scope")
      >();
    return {
      ...actual,
      withIntegrationTask: async (
        _taskId: string,
        _integration: unknown,
        apply: (
          database: unknown,
          afterCommit: (effect: () => Promise<void>) => void,
        ) => Promise<unknown>,
      ) => {
        const database = (await import("../../../../apps/api/src/database"))
          .default;
        const effects: Array<() => Promise<void>> = [];
        const result = await apply(database, (effect) => effects.push(effect));
        for (const effect of effects) await effect();
        return result;
      },
    };
  },
);
it("skips a reopen that Kaneo already applied", async () => {
  m.find.mockResolvedValue([{ id: "integration-1" }]);
  m.links.mockResolvedValue({
    id: "first",
    taskId: "task",
    metadata: '{"state":"open"}',
  });
  await handleIssueReopened(payload);
  expect(m.update).not.toHaveBeenCalled();
  expect(m.status).not.toHaveBeenCalled();
});

vi.mock(
  "../../../../apps/api/src/plugins/github/services/with-integration-link",
  async () => ({
    withIntegrationLink: async (
      link: unknown,
      integration: unknown,
      apply: (
        database: unknown,
        afterCommit: (effect: () => Promise<void>) => void,
        link: unknown,
      ) => Promise<unknown>,
    ) => {
      const { withIntegrationTask } =
        await import("../../../../apps/api/src/plugins/github/services/integration-task-scope");
      return withIntegrationTask(
        (link as { taskId: string }).taskId,
        integration as Parameters<typeof withIntegrationTask>[1],
        (database, afterCommit) => apply(database, afterCommit, link),
      );
    },
  }),
);
