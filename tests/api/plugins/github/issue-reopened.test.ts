import { beforeEach, expect, it, vi } from "vitest";
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
    },
  },
}));
vi.mock("../../../../apps/api/src/events", () => ({ publishEvent: m.publish }));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/task-service",
  () => ({ findAllIntegrationsByRepo: m.find, updateTaskStatus: m.status }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({ updateExternalLink: m.update }),
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
    expect(m.update).toHaveBeenCalledWith("first", {
      metadata: { state: "open" },
    });
    expect(m.update).toHaveBeenCalledWith("second", {
      metadata: { custom: "keep", state: "open" },
    });
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
