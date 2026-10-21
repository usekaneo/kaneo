import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import getAssignedTasks, {
  type AssignedTasks,
} from "@/fetchers/task/get-assigned-tasks";
import { mergeAssignedTaskPages } from "@/components/my-tasks/merge-assigned-task-pages";
import { useGetAssignedTaskPages } from "./use-get-assigned-task-pages";

vi.mock("@/fetchers/task/get-assigned-tasks", () => ({ default: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function page(ids: string[], total: number): AssignedTasks {
  return {
    tasks: ids.map((id) => ({
      id,
      title: id,
      projectId: "project",
      number: 1,
      status: "to-do",
      statusName: "To do",
      statusIcon: null,
      priority: "low",
      dueDate: null,
      projectName: "Project",
      projectSlug: "PROJ",
      projectIcon: null,
      labels: [],
    })),
    total,
  };
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("My Tasks pagination", () => {
  it("keeps loaded tasks on failure and allows retrying the same next page", async () => {
    const first = page(["a", "b"], 3);
    vi.mocked(getAssignedTasks)
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(page(["c"], 3));
    const { result } = renderHook(
      () => ({ ...useGetAssignedTaskPages("workspace") }),
      {
        wrapper: wrapper(),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.data?.pages).toEqual([first]);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(
      vi.mocked(getAssignedTasks).mock.calls.map((args) => args[2]),
    ).toEqual([1, 2, 2]);
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(
      mergeAssignedTaskPages(result.current.data?.pages ?? []).tasks.map(
        (task) => task.id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("does not show a previous workspace's pages when switching workspaces", async () => {
    vi.mocked(getAssignedTasks).mockImplementation(async (workspace) =>
      page([workspace], 1),
    );
    const { result, rerender } = renderHook(
      ({ workspace }) => ({ ...useGetAssignedTaskPages(workspace) }),
      { wrapper: wrapper(), initialProps: { workspace: "first" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ workspace: "second" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(result.current.data?.pages[0].tasks[0].id).toBe("second"),
    );
  });

  it("deduplicates rows moved between pages and stops after an empty page", async () => {
    vi.mocked(getAssignedTasks)
      .mockResolvedValueOnce(page(["a", "b"], 4))
      .mockResolvedValueOnce(page(["b", "c"], 4))
      .mockResolvedValueOnce(page([], 3));
    const { result } = renderHook(
      () => ({ ...useGetAssignedTaskPages("workspace") }),
      {
        wrapper: wrapper(),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      const next = await result.current.fetchNextPage();
      expect(next.error).toBeNull();
    });
    expect(
      vi.mocked(getAssignedTasks).mock.calls.map((args) => args[2]),
    ).toEqual([1, 2]);
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(
      mergeAssignedTaskPages(result.current.data?.pages ?? []).tasks.map(
        (task) => task.id,
      ),
    ).toEqual(["a", "b", "c"]);
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });
});
