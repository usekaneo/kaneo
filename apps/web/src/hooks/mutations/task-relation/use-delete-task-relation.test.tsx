import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDeleteTaskRelation from "./use-delete-task-relation";

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("@/fetchers/task-relation/delete-task-relation", () => ({
  default: remove,
}));

afterEach(cleanup);
beforeEach(() => {
  remove.mockReset();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["task-relations", "task-1"], []);
  client.setQueryData(["task-relations", "project", "project-a"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => useDeleteTaskRelation("task-1"), {
      wrapper,
    }),
  };
}

describe("useDeleteTaskRelation cache invalidation", () => {
  it("invalidates the owning task's cache and every project-scoped Gantt cache", async () => {
    remove.mockResolvedValue({ id: "rel-1" });
    const { client, result } = setup();

    act(() => result.current.mutate("rel-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      client.getQueryState(["task-relations", "task-1"])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(["task-relations", "project", "project-a"])
        ?.isInvalidated,
    ).toBe(true);
    client.clear();
  });
});
