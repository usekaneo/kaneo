import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import createTaskRelation from "@/fetchers/task-relation/create-task-relation";
import useCreateTaskRelation from "./use-create-task-relation";

vi.mock("@/fetchers/task-relation/create-task-relation", () => ({
  default: vi.fn(),
}));

afterEach(cleanup);

describe("useCreateTaskRelation", () => {
  it("refreshes the other task's cached relations while it is closed", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { refetchOnMount: false } },
    });
    const targetKey = ["task-relations", "task-b"];
    const reloadTarget = vi.fn().mockResolvedValue([{ id: "rel-1" }]);
    client.setQueryDefaults(targetKey, { queryFn: reloadTarget });
    client.setQueryData(targetKey, []);
    vi.mocked(createTaskRelation).mockResolvedValue(
      {} as Awaited<ReturnType<typeof createTaskRelation>>,
    );
    const { result } = renderHook(useCreateTaskRelation, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({
        sourceTaskId: "task-a",
        targetTaskId: "task-b",
        relationType: "blocks",
      });
    });

    await vi.waitFor(() => {
      expect(client.getQueryData(targetKey)).toEqual([{ id: "rel-1" }]);
    });
    expect(reloadTarget).toHaveBeenCalledTimes(1);
  });
});
