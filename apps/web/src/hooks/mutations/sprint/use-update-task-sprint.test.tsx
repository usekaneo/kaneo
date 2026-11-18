import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useUpdateTaskSprint } from "./use-update-task-sprint";

const { updateTaskSprint } = vi.hoisted(() => ({
  updateTaskSprint: vi.fn(),
}));

vi.mock("@/fetchers/sprint/update-task-sprint", () => ({
  default: updateTaskSprint,
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["task", "task-1"], { id: "task-1" });
  client.setQueryData(["tasks", "project-1"], { id: "project-1" });
  client.setQueryData(["sprints", "project-1"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useUpdateTaskSprint(), { wrapper }) };
}

afterEach(cleanup);

beforeEach(() => {
  updateTaskSprint.mockReset();
});

describe("useUpdateTaskSprint", () => {
  it("assigns the sprint and invalidates the task, task list, and sprints", async () => {
    updateTaskSprint.mockResolvedValueOnce({
      id: "task-1",
      projectId: "project-1",
      sprintId: "sprint-2",
    });
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        taskId: "task-1",
        projectId: "project-1",
        sprintId: "sprint-2",
      });
    });

    expect(updateTaskSprint).toHaveBeenCalledWith("task-1", "sprint-2");
    expect(client.getQueryState(["task", "task-1"])?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(["tasks", "project-1"])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(["sprints", "project-1"])?.isInvalidated,
    ).toBe(true);
    client.clear();
  });

  it("moves the task to the backlog with a null sprint", async () => {
    updateTaskSprint.mockResolvedValueOnce({
      id: "task-1",
      projectId: "project-1",
      sprintId: null,
    });
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        taskId: "task-1",
        projectId: "project-1",
        sprintId: null,
      });
    });

    expect(updateTaskSprint).toHaveBeenCalledWith("task-1", null);
  });
});
