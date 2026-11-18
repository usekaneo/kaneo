import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import createSprint from "./create-sprint";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { sprint: { ":projectId": { $post: request } } },
}));

const created = {
  id: "sprint-2",
  projectId: "project-1",
  name: "Sprint 2",
  goal: null,
  status: "future",
  startDate: "2025-01-15",
  endDate: "2025-01-29",
  carryOverTasks: null,
  position: 1,
  taskCount: 0,
  completedTaskCount: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

beforeEach(() => {
  request.mockReset();
});

describe("createSprint fetcher", () => {
  it("posts the sprint payload for the project and returns the created sprint", async () => {
    request.mockResolvedValueOnce(Response.json(created));

    const result = await createSprint("project-1", {
      name: "Sprint 2",
      startDate: "2025-01-15",
      endDate: "2025-01-29",
    });

    expect(result).toEqual(created);
    expect(request).toHaveBeenCalledWith({
      param: { projectId: "project-1" },
      json: {
        name: "Sprint 2",
        startDate: "2025-01-15",
        endDate: "2025-01-29",
      },
    });
  });

  it("throws an HttpError carrying the API status and message", async () => {
    request.mockResolvedValueOnce(
      Response.json(
        { message: 'Sprint "Sprint 1" already exists in this project' },
        { status: 409 },
      ),
    );

    await expect(
      createSprint("project-1", { name: "Sprint 1" }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Sprint "Sprint 1" already exists in this project',
    });
  });
});
