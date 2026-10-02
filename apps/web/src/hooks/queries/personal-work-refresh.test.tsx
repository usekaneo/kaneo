import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import useGetWorkspaceActivities from "./activity/use-get-workspace-activities";
import useGetAssignedTasks from "./task/use-get-assigned-tasks";
import useGetTask from "./task/use-get-task";
import useGetActivitiesByTaskId from "./activity/use-get-activities-by-task-id";
import useGetProjects from "./project/use-get-projects";

const mocks = vi.hoisted(() => ({
  assigned: vi.fn(),
  activities: vi.fn(),
  task: vi.fn(),
  comments: vi.fn(),
  projects: vi.fn(),
}));
vi.mock("@/fetchers/task/get-assigned-tasks", () => ({
  default: mocks.assigned,
}));
vi.mock("@/fetchers/activity/get-workspace-activities", () => ({
  default: mocks.activities,
}));

vi.mock("@/fetchers/task/get-task", () => ({ default: mocks.task }));
vi.mock("@/fetchers/activity/get-activites-by-task-id", () => ({
  default: mocks.comments,
}));
vi.mock("@/fetchers/project/get-projects", () => ({ default: mocks.projects }));

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("personal work refresh", () => {
  it("keeps sidebar counts separate from the full assigned-task cache", async () => {
    mocks.assigned.mockImplementation(async (_workspaceId, countOnly) => ({
      tasks: countOnly ? [] : [{ id: "task", title: "Assigned task" }],
      total: 101,
    }));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        list: useGetAssignedTasks("workspace").data,
        count: useGetAssignedTasks("workspace", true).data,
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list?.tasks).toEqual([
        { id: "task", title: "Assigned task" },
      ]);
      expect(result.current.count).toEqual({ tasks: [], total: 101 });
    });
    expect(mocks.assigned).toHaveBeenCalledWith("workspace", false);
    expect(mocks.assigned).toHaveBeenCalledWith("workspace", true);
    client.clear();
  });

  it("refreshes remote edits and comments without a project socket or notification", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    mocks.assigned.mockResolvedValue({
      tasks: [{ id: "task", title: "Before" }],
      total: 1,
    });
    mocks.activities.mockResolvedValue([]);
    mocks.task.mockResolvedValue({ title: "Before" });
    mocks.comments.mockResolvedValue([]);
    mocks.projects.mockResolvedValue([
      { statistics: { completionPercentage: 0 } },
    ]);
    const { result } = renderHook(
      () => {
        const tasks = useGetAssignedTasks("workspace");
        const activity = useGetWorkspaceActivities("workspace");
        const task = useGetTask("task", true);
        const comments = useGetActivitiesByTaskId("task", true);
        const projects = useGetProjects({ workspaceId: "workspace" });
        return {
          task: task.data,
          comments: comments.data,
          projects: projects.data,
          tasks: tasks.data,
          activity: activity.data,
          ready: tasks.isSuccess && activity.isSuccess,
        };
      },
      { wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.ready).toBe(true);
    mocks.assigned.mockResolvedValue({
      tasks: [{ id: "task", title: "After" }],
      total: 1,
    });
    mocks.activities.mockResolvedValue([{ id: "comment" }]);
    mocks.task.mockResolvedValue({ title: "After" });
    mocks.comments.mockResolvedValue([{ id: "comment" }]);
    mocks.projects.mockResolvedValue([
      { statistics: { completionPercentage: 50 } },
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010);
    });
    expect(mocks.assigned).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.tasks?.tasks[0].title).toBe("After");
    expect(result.current.activity).toEqual([{ id: "comment" }]);

    expect(result.current.task?.title).toBe("After");
    expect(result.current.comments).toEqual([{ id: "comment" }]);
    expect(result.current.projects?.[0].statistics.completionPercentage).toBe(
      50,
    );

    focusManager.setFocused(false);
    const calls = mocks.assigned.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.assigned).toHaveBeenCalledTimes(calls);
    client.clear();
  });
});
