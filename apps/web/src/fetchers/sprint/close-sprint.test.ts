import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import closeSprint from "./close-sprint";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { sprint: { close: { ":id": { $post: request } } } },
}));

const closeResult = {
  sprint: {
    id: "sprint-1",
    projectId: "project-1",
    name: "Sprint 1",
    goal: null,
    status: "closed",
    startDate: "2025-01-15",
    endDate: "2025-01-29",
    carryOverTasks: [{ id: "task-1", title: "Polish the board" }],
    position: 1,
    taskCount: 2,
    completedTaskCount: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-29T00:00:00.000Z",
  },
  movedTaskIds: ["task-1"],
  targetSprintId: "sprint-2",
};

beforeEach(() => {
  request.mockReset();
});

describe("closeSprint fetcher", () => {
  it("posts the close request with the chosen carry-over target", async () => {
    request.mockResolvedValueOnce(Response.json(closeResult));

    const result = await closeSprint("sprint-1", "sprint-2");

    expect(result).toEqual(closeResult);
    expect(request).toHaveBeenCalledWith({
      param: { id: "sprint-1" },
      json: { targetSprintId: "sprint-2" },
    });
  });

  it("posts a null target when unfinished tasks go to the backlog", async () => {
    request.mockResolvedValueOnce(
      Response.json({ ...closeResult, targetSprintId: null }),
    );

    await closeSprint("sprint-1", null);

    expect(request).toHaveBeenCalledWith({
      param: { id: "sprint-1" },
      json: { targetSprintId: null },
    });
  });

  it("throws an HttpError carrying the API status and message", async () => {
    request.mockResolvedValueOnce(
      Response.json(
        { message: "Only the active sprint can be closed" },
        { status: 409 },
      ),
    );

    await expect(closeSprint("sprint-1", null)).rejects.toMatchObject({
      status: 409,
      message: "Only the active sprint can be closed",
    });
  });
});
