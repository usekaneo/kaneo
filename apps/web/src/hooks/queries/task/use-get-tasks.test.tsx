import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import queryClient from "@/query-client";
import useGetPublicProject from "../project/use-get-public-project";
import { useGetTasks } from "./use-get-tasks";

const getTasks = vi.hoisted(() => vi.fn());
const getPublicProject = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/task/get-tasks", () => ({ default: getTasks }));
vi.mock("@/fetchers/project/get-public-project", () => ({
  default: getPublicProject,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  queryClient.clear();
  getTasks.mockReset();
  getPublicProject.mockReset();
});

describe("useGetTasks", () => {
  it("refreshes a cached public board when revisited", async () => {
    queryClient.setQueryData(["public-project", "public-parent"], {
      columns: [{ tasks: [{ subtaskCounts: { completed: 0, total: 1 } }] }],
    });
    const updated = {
      columns: [{ tasks: [{ subtaskCounts: { completed: 1, total: 1 } }] }],
    };
    getPublicProject.mockResolvedValue(updated);
    const { result } = renderHook(() => useGetPublicProject("public-parent"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(updated));
    expect(getPublicProject).toHaveBeenCalledWith({ id: "public-parent" });
  });

  it("refreshes cached parent progress on return without a parent socket", async () => {
    const parent = {
      id: "parent-project",
      columns: [
        {
          tasks: [{ id: "parent", subtaskCounts: { completed: 0, total: 1 } }],
        },
      ],
    };
    getTasks.mockResolvedValue(parent);
    const firstVisit = renderHook(() => useGetTasks("parent-project"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(firstVisit.result.current.data).toEqual(parent));
    firstVisit.unmount();

    // Deleting the child project changes the server while the parent is inactive.
    // No socket event or local invalidation reaches this cached board.
    const updatedParent = {
      ...parent,
      columns: [
        {
          tasks: [{ id: "parent", subtaskCounts: { completed: 0, total: 0 } }],
        },
      ],
    };
    getTasks.mockResolvedValue(updatedParent);
    expect(queryClient.getQueryData(["tasks", "parent-project"])).toEqual(
      parent,
    );
    const returnVisit = renderHook(() => useGetTasks("parent-project"), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(returnVisit.result.current.data).toEqual(updatedParent),
    );
    expect(getTasks).toHaveBeenCalledTimes(2);
  });
});
