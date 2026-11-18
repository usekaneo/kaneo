import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// The mock handles are hoisted so the vi.mock factories below may reference
// them: vi.mock calls are hoisted above every top-level const, so plain
// consts would still be undefined when the factories run.
const {
  mockTaskFindFirst,
  mockSprintFindFirst,
  mockUpdate,
  mockPublishEvent,
} = vi.hoisted(() => ({
  mockTaskFindFirst: vi.fn(),
  mockSprintFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublishEvent: vi.fn(),
}));

vi.mock("../../database", () => ({
  default: {
    query: {
      taskTable: { findFirst: (args: unknown) => mockTaskFindFirst(args) },
    },
    // The transaction hands the controller a tx with the chains
    // updateTaskSprint runs: the locked sprint reads (the task's current
    // sprint first, the target sprint second) and the task update. The
    // sprint reads share one ordered queue.
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        select: () => ({
          from: () => ({
            where: () => ({
              for: () => {
                const row = mockSprintFindFirst();
                return Promise.resolve(row ? [row] : []);
              },
            }),
          }),
        }),
        update: () => ({
          set: (values: Record<string, unknown>) => ({
            where: () => ({ returning: () => mockUpdate(values) }),
          }),
        }),
      }),
  },
}));

vi.mock("../../events", () => ({ publishEvent: mockPublishEvent }));

import updateTaskSprint from "./update-task-sprint";

const backlogTask = {
  id: "task-1",
  projectId: "project-1",
  sprintId: null,
};

const futureSprint = {
  id: "sprint-2",
  projectId: "project-1",
  name: "Sprint 2",
  goal: null,
  status: "future",
  startDate: null,
  endDate: null,
  position: 1,
  carryOverTasks: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  mockTaskFindFirst.mockReset();
  mockSprintFindFirst.mockReset();
  mockUpdate.mockReset();
  mockPublishEvent.mockReset();
});

describe("updateTaskSprint", () => {
  it("moves a backlog task into a future sprint of the same project", async () => {
    mockTaskFindFirst.mockResolvedValueOnce(backlogTask);
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockUpdate.mockResolvedValueOnce([
      { id: "task-1", projectId: "project-1", sprintId: "sprint-2" },
    ]);

    const result = await updateTaskSprint({
      taskId: "task-1",
      sprintId: "sprint-2",
      currentUserId: "user-1",
    });

    expect(result).toEqual({
      id: "task-1",
      projectId: "project-1",
      sprintId: "sprint-2",
    });
    expect(mockUpdate).toHaveBeenCalledWith({ sprintId: "sprint-2" });
    expect(mockPublishEvent).toHaveBeenCalledWith("task.sprint_changed", {
      taskId: "task-1",
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mockPublishEvent).toHaveBeenCalledWith("sprint.updated", {
      projectId: "project-1",
    });
  });

  it("moves a sprint task to the backlog", async () => {
    mockTaskFindFirst.mockResolvedValueOnce({
      ...backlogTask,
      sprintId: "sprint-1",
    });
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      id: "sprint-1",
      status: "active",
    });
    mockUpdate.mockResolvedValueOnce([
      { id: "task-1", projectId: "project-1", sprintId: null },
    ]);

    const result = await updateTaskSprint({
      taskId: "task-1",
      sprintId: null,
      currentUserId: "user-1",
    });

    expect(result.sprintId).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith({ sprintId: null });
  });

  it("rejects an unknown task with 404", async () => {
    mockTaskFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      updateTaskSprint({
        taskId: "missing",
        sprintId: null,
        currentUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Task not found",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a task that already sits in a closed sprint with 409", async () => {
    mockTaskFindFirst.mockResolvedValueOnce({
      ...backlogTask,
      sprintId: "sprint-0",
    });
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      id: "sprint-0",
      status: "closed",
    });

    await expect(
      updateTaskSprint({
        taskId: "task-1",
        sprintId: null,
        currentUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "The task belongs to a closed sprint and stays there as implementation history",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a target sprint from another project with 404", async () => {
    mockTaskFindFirst.mockResolvedValueOnce(backlogTask);
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      projectId: "project-2",
    });

    await expect(
      updateTaskSprint({
        taskId: "task-1",
        sprintId: "sprint-2",
        currentUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Target sprint not found in this project",
    });
  });

  it("rejects a closed target sprint with 409", async () => {
    mockTaskFindFirst.mockResolvedValueOnce(backlogTask);
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      status: "closed",
    });

    await expect(
      updateTaskSprint({
        taskId: "task-1",
        sprintId: "sprint-2",
        currentUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Cannot assign tasks to a closed sprint",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
