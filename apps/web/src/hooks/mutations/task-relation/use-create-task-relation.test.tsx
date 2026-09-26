import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useCreateTaskRelation from "./use-create-task-relation";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/fetchers/task-relation/create-task-relation", () => ({
  default: create,
}));

afterEach(cleanup);
beforeEach(() => {
  create.mockReset();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  // Seeded as a stand-in for whatever project(s) happen to have a Gantt
  // view open — the mutation doesn't know which project(s) the two tasks
  // belong to, so it must invalidate every project-scoped cache.
  client.setQueryData(["task-relations", "project", "project-a"], []);
  client.setQueryData(["task-relations", "task-1"], []);
  client.setQueryData(["task-relations", "task-2"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(useCreateTaskRelation, { wrapper }) };
}

describe("useCreateTaskRelation cache invalidation", () => {
  it("invalidates the source/target task caches and every project-scoped Gantt cache", async () => {
    create.mockResolvedValue({
      id: "rel-1",
      sourceTaskId: "task-1",
      targetTaskId: "task-2",
      relationType: "blocks",
    });
    const { client, result } = setup();

    act(() =>
      result.current.mutate({
        sourceTaskId: "task-1",
        targetTaskId: "task-2",
        relationType: "blocks",
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      client.getQueryState(["task-relations", "task-1"])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(["task-relations", "task-2"])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(["task-relations", "project", "project-a"])
        ?.isInvalidated,
    ).toBe(true);
    client.clear();
  });
});
