import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import useGetWorkspaceActivities from "./activity/use-get-workspace-activities";
import useGetAssignedTasks from "./task/use-get-assigned-tasks";

const mocks = vi.hoisted(() => ({
  assigned: vi.fn(),
  activities: vi.fn(),
}));
vi.mock("@/fetchers/task/get-assigned-tasks", () => ({
  default: mocks.assigned,
}));
vi.mock("@/fetchers/activity/get-workspace-activities", () => ({
  default: mocks.activities,
}));

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("personal work refresh", () => {
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
    const { result } = renderHook(
      () => {
        const tasks = useGetAssignedTasks("workspace");
        const activity = useGetWorkspaceActivities("workspace");
        return {
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010);
    });
    expect(mocks.assigned).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.tasks?.tasks[0].title).toBe("After");
    expect(result.current.activity).toEqual([{ id: "comment" }]);

    focusManager.setFocused(false);
    const calls = mocks.assigned.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.assigned).toHaveBeenCalledTimes(calls);
    client.clear();
  });
});
