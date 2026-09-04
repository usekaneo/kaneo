import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import deleteTask from "@/fetchers/task/delete-task";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import { useDeleteTask } from "./use-delete-task";

vi.mock("@/fetchers/task/delete-task", () => ({
  default: vi.fn(),
}));

function makeTask(id: string): Task {
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
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
  };
}

function makeProject() {
  return {
    id: "project-1",
    name: "Project",
    slug: "PROJ",
    icon: null,
    description: null,
    isPublic: false,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    workspaceId: "workspace-1",
    columns: [
      {
        id: "todo",
        slug: "to-do",
        name: "To Do",
        icon: null,
        isFinal: false,
        tasks: [makeTask("delete-me"), makeTask("keep-me")],
      },
    ],
    plannedTasks: [makeTask("delete-me")],
    archivedTasks: [makeTask("delete-me")],
  };
}

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  vi.clearAllMocks();
  useProjectStore.getState().setProject(undefined);
});

afterEach(() => {
  queryClient.clear();
  useProjectStore.getState().setProject(undefined);
});

describe("useDeleteTask", () => {
  it("removes a deleted task from query and project-store state", async () => {
    const project = makeProject();
    const deletedTask = {
      ...makeTask("delete-me"),
      priority: "no-priority",
    };
    queryClient.setQueryData(["tasks", project.id], project);
    queryClient.setQueryData(["task", deletedTask.id], deletedTask);
    useProjectStore.getState().setProject(project);
    vi.mocked(deleteTask).mockResolvedValue(deletedTask);

    const { result } = renderHook(() => useDeleteTask(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(deletedTask.id);
    });

    const cachedProject = queryClient.getQueryData<
      ReturnType<typeof makeProject>
    >(["tasks", project.id]);
    expect(cachedProject?.columns[0]?.tasks.map(({ id }) => id)).toEqual([
      "keep-me",
    ]);
    expect(cachedProject?.plannedTasks).toEqual([]);
    expect(cachedProject?.archivedTasks).toEqual([]);
    expect(queryClient.getQueryData(["task", deletedTask.id])).toBeUndefined();
    expect(
      queryClient.getQueryState(["tasks", project.id])?.isInvalidated,
    ).toBe(true);

    const storedProject = useProjectStore.getState().project;
    expect(storedProject?.columns[0]?.tasks.map(({ id }) => id)).toEqual([
      "keep-me",
    ]);
    expect(storedProject?.plannedTasks).toEqual([]);
    expect(storedProject?.archivedTasks).toEqual([]);
  });

  it("leaves query and project-store state unchanged when deletion fails", async () => {
    const project = makeProject();
    const task = makeTask("delete-me");
    queryClient.setQueryData(["tasks", project.id], project);
    queryClient.setQueryData(["task", task.id], task);
    useProjectStore.getState().setProject(project);
    vi.mocked(deleteTask).mockRejectedValue(new Error("Delete failed"));

    const { result } = renderHook(() => useDeleteTask(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(task.id)).rejects.toThrow(
        "Delete failed",
      );
    });

    expect(queryClient.getQueryData(["tasks", project.id])).toEqual(project);
    expect(queryClient.getQueryData(["task", task.id])).toEqual(task);
    expect(useProjectStore.getState().project).toEqual(project);
  });
});
