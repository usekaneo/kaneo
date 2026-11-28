import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";
import useDeleteTaskRelation from "./use-delete-task-relation";

vi.mock("@/fetchers/task-relation/delete-task-relation", () => ({
  default: vi.fn(),
}));

afterEach(cleanup);

describe("useDeleteTaskRelation", () => {
  it("refreshes the other task's cached relations while it is closed", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { refetchOnMount: false } },
    });
    const targetKey = ["task-relations", "task-b"];
    const reloadTarget = vi.fn().mockResolvedValue([]);
    client.setQueryDefaults(targetKey, { queryFn: reloadTarget });
    client.setQueryData(targetKey, [{ id: "rel-1" }]);
    vi.mocked(deleteTaskRelation).mockResolvedValue({
      sourceTaskId: "task-a",
      targetTaskId: "task-b",
    } as Awaited<ReturnType<typeof deleteTaskRelation>>);
    const { result } = renderHook(() => useDeleteTaskRelation("task-a"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync("rel-1");
    });

    await vi.waitFor(() => {
      expect(client.getQueryData(targetKey)).toEqual([]);
    });
    expect(reloadTarget).toHaveBeenCalledTimes(1);
  });
});
