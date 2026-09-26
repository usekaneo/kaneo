import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  delete: vi.fn(),
  deleteS3Object: vi.fn(),
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: { projectTable: { findFirst: mocks.findFirst } },
    delete: mocks.delete,
  },
}));

vi.mock("../../../apps/api/src/storage/s3", () => ({
  deleteS3Object: mocks.deleteS3Object,
}));

import deleteProject from "../../../apps/api/src/project/controllers/delete-project";

function mockDeletedProject(backgroundObjectKey: string | null) {
  const returning = vi
    .fn()
    .mockResolvedValue([{ id: "project-1", backgroundObjectKey }]);
  const where = vi.fn(() => ({ returning }));
  mocks.delete.mockReturnValue({ where });
}

describe("deleteProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      tasks: [],
    });
    mocks.deleteS3Object.mockResolvedValue(undefined);
  });

  it("deletes the background object after deleting its project", async () => {
    mockDeletedProject(
      "workspace/ws/project/project-1/backgrounds/background-v1",
    );

    await deleteProject("project-1", "workspace-1");

    expect(mocks.deleteS3Object).toHaveBeenCalledWith(
      "workspace/ws/project/project-1/backgrounds/background-v1",
    );
  });

  it("does not call object storage when the project has no background", async () => {
    mockDeletedProject(null);

    await deleteProject("project-1", "workspace-1");

    expect(mocks.deleteS3Object).not.toHaveBeenCalled();
  });

  it("does not fail project deletion when object cleanup fails", async () => {
    mockDeletedProject("background-v1");
    mocks.deleteS3Object.mockRejectedValue(new Error("storage unavailable"));

    await expect(
      deleteProject("project-1", "workspace-1"),
    ).resolves.toMatchObject({ id: "project-1" });
  });
});
