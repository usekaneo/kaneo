import { beforeEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import updateTask from "./update-task";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    task: {
      ":id": {
        $put: mocks.put,
      },
    },
  },
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Task",
    number: 1,
    description: null,
    status: "to-do",
    priority: "low",
    startDate: null,
    dueDate: null,
    timeEstimate: null,
    position: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    ...overrides,
  };
}

describe("updateTask", () => {
  beforeEach(() => {
    mocks.put.mockReset();
    mocks.put.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "task-1" }),
    });
  });

  it("sends the time estimate so full updates do not clear it", async () => {
    await updateTask("task-1", makeTask({ timeEstimate: 7200 }));

    expect(mocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({ timeEstimate: 7200 }),
      }),
    );
  });

  it("sends null when the task has no estimate", async () => {
    await updateTask("task-1", makeTask({ timeEstimate: null }));

    expect(mocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({ timeEstimate: null }),
      }),
    );
  });
});
