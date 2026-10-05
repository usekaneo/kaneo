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
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import useCreateComment from "@/hooks/mutations/comment/use-create-comment";
import useUpdateComment from "@/hooks/mutations/comment/use-update-comment";
import useDeleteComment from "@/hooks/mutations/comment/use-delete-comment";
import { useGetColumns } from "./column/use-get-columns";
import useGetProjects from "./project/use-get-projects";

const mocks = vi.hoisted(() => ({
  assigned: vi.fn(),
  activities: vi.fn(),
  task: vi.fn(),
  comments: vi.fn(),
  projects: vi.fn(),
  columns: vi.fn(),
  createTask: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
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
vi.mock("@/fetchers/column/get-columns", () => ({ default: mocks.columns }));
vi.mock("@/fetchers/project/get-projects", () => ({ default: mocks.projects }));

vi.mock("@/fetchers/task/create-task", () => ({ default: mocks.createTask }));
vi.mock("@/lib/analytics/activation", () => ({ trackFirstTask: vi.fn() }));
vi.mock("@/fetchers/comment/create-comment", () => ({
  default: mocks.createComment,
}));
vi.mock("@/fetchers/comment/update-comment", () => ({
  default: mocks.updateComment,
}));
vi.mock("@/fetchers/comment/delete-comment", () => ({
  default: mocks.deleteComment,
}));

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

  it("keeps bounded inbox activity separate from full task history", async () => {
    mocks.comments.mockImplementation(async ({ limit }) =>
      Array.from({ length: limit ?? 10 }, (_, id) => ({ id })),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        full: useGetActivitiesByTaskId("task").data,
        preview: useGetActivitiesByTaskId("task", true, 6).data,
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.full).toHaveLength(10);
      expect(result.current.preview).toHaveLength(6);
    });
    expect(mocks.comments).toHaveBeenCalledWith({ taskId: "task", limit: 6 });
    client.clear();
  });

  it("keeps project pickers cached and polls only for an opted-in observer", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    client.setQueryData(["projects", "workspace"], [{ id: "cached" }]);
    mocks.projects.mockResolvedValue([{ id: "fresh" }]);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ refresh }) => useGetProjects({ workspaceId: "workspace" }, refresh),
      { wrapper, initialProps: { refresh: false } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_010);
    });
    expect(mocks.projects).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([{ id: "cached" }]);
    rerender({ refresh: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010);
    });
    expect(mocks.projects).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual([{ id: "fresh" }]);
    client.clear();
  });

  it("refreshes cached Inbox workflow names on mount, while visible and on focus", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    client.setQueryData(
      ["columns", "project"],
      [{ id: "review", name: "Old name" }],
    );
    mocks.columns.mockResolvedValue([
      { id: "review", name: "Renamed", icon: "Flag" },
    ]);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const cached = renderHook(() => useGetColumns("project"), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_010);
    });
    expect(mocks.columns).not.toHaveBeenCalled();
    cached.unmount();
    const { result } = renderHook(
      () => useGetColumns("project", { refreshWhileVisible: true }),
      { wrapper },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mocks.columns).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual([
      { id: "review", name: "Renamed", icon: "Flag" },
    ]);
    const calls = mocks.columns.mock.calls.length;
    mocks.columns.mockResolvedValue([
      { id: "review", name: "Changed again", icon: "Circle" },
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010);
    });
    expect(mocks.columns).toHaveBeenCalledTimes(calls + 1);
    expect(result.current.data?.[0].name).toBe("Changed again");
    focusManager.setFocused(false);
    const backgroundCalls = mocks.columns.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.columns).toHaveBeenCalledTimes(backgroundCalls);
    await act(async () => {
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mocks.columns).toHaveBeenCalledTimes(backgroundCalls + 1);
    client.clear();
  });

  it("refreshes Home project statistics immediately after task creation", async () => {
    mocks.projects.mockResolvedValue([
      { id: "project", statistics: { totalTasks: 1 } },
    ]);
    mocks.createTask.mockResolvedValue({ id: "created", projectId: "project" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        projects: useGetProjects({ workspaceId: "workspace" }),
        create: useCreateTask(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.projects.isSuccess).toBe(true));
    mocks.projects.mockResolvedValue([
      { id: "project", statistics: { totalTasks: 2 } },
    ]);
    await act(async () => {
      await result.current.create.mutateAsync({
        projectId: "project",
        title: "New",
        description: "",
        status: "to-do",
        priority: "no-priority",
      });
    });
    await waitFor(() =>
      expect(result.current.projects.data?.[0].statistics.totalTasks).toBe(2),
    );
    expect(mocks.projects).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it.each(["create", "edit", "delete"])(
    "refreshes Home activity immediately after comment %s without refreshing assigned counts",
    async (action) => {
      mocks.activities.mockResolvedValue([]);
      mocks.assigned.mockResolvedValue({ tasks: [], total: 0 });
      mocks.createComment.mockResolvedValue({ id: "comment" });
      mocks.updateComment.mockResolvedValue({ id: "comment" });
      mocks.deleteComment.mockResolvedValue({ id: "comment" });
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(
        () => ({
          activity: useGetWorkspaceActivities("workspace"),
          assigned: useGetAssignedTasks("workspace", true),
          create: useCreateComment(),
          edit: useUpdateComment(),
          remove: useDeleteComment("task"),
        }),
        { wrapper },
      );
      await waitFor(() => {
        expect(result.current.activity.isSuccess).toBe(true);
        expect(result.current.assigned.isSuccess).toBe(true);
      });
      mocks.activities.mockResolvedValue([{ id: "fresh" }]);
      await act(async () => {
        if (action === "create")
          await result.current.create.mutateAsync({
            taskId: "task",
            comment: "Added",
          });
        else if (action === "edit")
          await result.current.edit.mutateAsync({
            activityId: "comment",
            comment: "Edited",
          });
        else await result.current.remove.mutateAsync({ activityId: "comment" });
      });
      await waitFor(() =>
        expect(result.current.activity.data).toEqual([{ id: "fresh" }]),
      );
      expect(mocks.activities).toHaveBeenCalledTimes(2);
      expect(mocks.assigned).toHaveBeenCalledOnce();
      client.clear();
    },
  );

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
        const projects = useGetProjects({ workspaceId: "workspace" }, true);
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
