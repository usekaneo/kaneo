import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import type Task from "@/types/task";
import { findCachedTask } from "./find-cached-task";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    number: 1,
    description: null,
    status: "to-do",
    priority: null,
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "p1",
    ...overrides,
  };
}

describe("findCachedTask", () => {
  it("prefers the live board cache over the task detail", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["task", "t2"], task("t2", { title: "Detail" }));
    queryClient.setQueryData(["tasks", "p1"], {
      columns: [{ tasks: [task("t1")] }, { tasks: [task("t2")] }],
      plannedTasks: [task("t3")],
      archivedTasks: [task("t4")],
    });
    queryClient.setQueryData(
      ["tasks", "p1", "description-matches", "x"],
      [task("t2", { title: "Search" })],
    );

    expect(findCachedTask(queryClient, "t2")?.title).toBe("t2");
    expect(findCachedTask(queryClient, "t3")?.id).toBe("t3");
    expect(findCachedTask(queryClient, "t4")?.id).toBe("t4");
  });

  it("falls back to the task detail, then to nothing", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["task", "t9"], task("t9"));

    expect(findCachedTask(queryClient, "t9")?.id).toBe("t9");
    expect(findCachedTask(queryClient, "missing")).toBeUndefined();
  });
});
