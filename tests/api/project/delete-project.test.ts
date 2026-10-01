import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  queueStorageCleanup: vi.fn(),
  retryStorageCleanup: vi.fn(),
  publishEvent: vi.fn(),
  getProjectSubtaskParentProjects: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: { projectTable: { findFirst: mocks.findFirst } },
    transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ select: mocks.select, delete: mocks.delete }),
  },
}));
vi.mock("../../../apps/api/src/storage/cleanup-queue", () => ({
  queueStorageCleanup: mocks.queueStorageCleanup,
  retryStorageCleanup: mocks.retryStorageCleanup,
}));
vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: mocks.publishEvent,
}));
vi.mock("../../../apps/api/src/task/get-subtask-parent-projects", () => ({
  getProjectSubtaskParentProjects: mocks.getProjectSubtaskParentProjects,
}));
import deleteProject from "../../../apps/api/src/project/controllers/delete-project";
function seed(backgroundObjectKey: string | null, assets: string[] = []) {
  const project = {
    id: "project-1",
    workspaceId: "workspace-1",
    backgroundObjectKey,
  };
  mocks.select
    .mockReturnValueOnce({
      from: () => ({ where: () => ({ for: async () => [project] }) }),
    })
    .mockReturnValueOnce({
      from: () => ({
        where: async () => assets.map((objectKey) => ({ objectKey })),
      }),
    });
  mocks.delete.mockReturnValue({
    where: () => ({ returning: async () => [project] }),
  });
}
describe("deleteProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      tasks: [],
    });
    mocks.getProjectSubtaskParentProjects.mockResolvedValue([
      { projectId: "parent-project" },
    ]);
    mocks.retryStorageCleanup.mockResolvedValue({ degraded: false });
  });
  it("queues all attachment keys and the background before the cascade", async () => {
    seed("background", ["attachment-a", "attachment-b"]);
    await deleteProject("project-1", "workspace-1");
    expect(mocks.queueStorageCleanup).toHaveBeenCalledWith(expect.anything(), [
      "attachment-a",
      "attachment-b",
      "background",
    ]);
    expect(mocks.queueStorageCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.delete.mock.invocationCallOrder[0],
    );
    expect(mocks.publishEvent).toHaveBeenCalledWith("subtask-parents.refresh", {
      projects: [{ projectId: "parent-project" }],
    });
  });
  it("still succeeds while durable cleanup waits for storage recovery", async () => {
    seed("background");
    mocks.retryStorageCleanup.mockRejectedValue(
      new Error("storage unavailable"),
    );
    await expect(
      deleteProject("project-1", "workspace-1"),
    ).resolves.toMatchObject({ id: "project-1" });
  });
});
