import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import updateTaskSprint from "./update-task-sprint";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { sprint: { task: { ":taskId": { $put: request } } } },
}));

beforeEach(() => {
  request.mockReset();
});

describe("updateTaskSprint fetcher", () => {
  it("puts the chosen sprint on the task", async () => {
    request.mockResolvedValueOnce(
      Response.json({ id: "task-1", sprintId: "sprint-2" }),
    );

    const result = await updateTaskSprint("task-1", "sprint-2");

    expect(result).toEqual({ id: "task-1", sprintId: "sprint-2" });
    expect(request).toHaveBeenCalledWith({
      param: { taskId: "task-1" },
      json: { sprintId: "sprint-2" },
    });
  });

  it("puts a null sprint to move the task to the backlog", async () => {
    request.mockResolvedValueOnce(
      Response.json({ id: "task-1", sprintId: null }),
    );

    await updateTaskSprint("task-1", null);

    expect(request).toHaveBeenCalledWith({
      param: { taskId: "task-1" },
      json: { sprintId: null },
    });
  });

  it("throws an HttpError when the target sprint is closed", async () => {
    request.mockResolvedValueOnce(
      Response.json(
        { message: "Cannot assign tasks to a closed sprint" },
        { status: 409 },
      ),
    );

    await expect(
      updateTaskSprint("task-1", "sprint-0"),
    ).rejects.toMatchObject({
      status: 409,
      message: "Cannot assign tasks to a closed sprint",
    });
  });
});
