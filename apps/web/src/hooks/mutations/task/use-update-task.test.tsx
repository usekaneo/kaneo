import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import { useUpdateTask } from "./use-update-task";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/fetchers/task/update-task", () => ({
  default: update,
}));

afterEach(cleanup);
beforeEach(() => {
  update.mockReset();
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Task",
    number: 1,
    description: null,
    status: "in-progress",
    priority: null,
    startDate: null,
    dueDate: null,
    progress: 0,
    isMilestone: false,
    baselineStartDate: null,
    baselineDueDate: null,
    position: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    ...overrides,
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["task", "task-1"], {});
  client.setQueryData(["tasks", "project-1"], {});
  client.setQueryData(["notifications"], {});
  client.setQueryData(["projects"], {});
  client.setQueryData(["activities", "task-1"], {});
  client.setQueryData(["task-relations", "project", "project-2"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => useUpdateTask(), { wrapper }),
  };
}

describe("useUpdateTask cache invalidation", () => {
  it("invalidates every project's task-relations cache, so another project's external Gantt row refreshes", async () => {
    update.mockResolvedValue(makeTask());
    const { client, result } = setup();

    act(() => {
      result.current.mutate(makeTask({ startDate: "2026-09-01" }));
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      client.getQueryState(["task-relations", "project", "project-2"])
        ?.isInvalidated,
    ).toBe(true);
    client.clear();
  });

  it("still invalidates the task's own project/task/activity caches", async () => {
    update.mockResolvedValue(makeTask());
    const { client, result } = setup();

    act(() => {
      result.current.mutate(makeTask());
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.getQueryState(["task", "task-1"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["tasks", "project-1"])?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(["activities", "task-1"])?.isInvalidated).toBe(
      true,
    );
    client.clear();
  });
});
