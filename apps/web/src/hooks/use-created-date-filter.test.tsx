import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

vi.mock("./queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: undefined }),
}));

const storageKey = "kaneo:board-filters:project-1";
const task: Task = {
  id: "task-1",
  title: "New work",
  number: 1,
  description: null,
  status: "to-do",
  priority: "high",
  startDate: null,
  dueDate: null,
  position: 0,
  createdAt: new Date(2026, 9, 21, 12).toISOString(),
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
};

function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("creation-date filters", () => {
  it("restores a negated filter and clears its value, operator, and count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 23));
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        createdDate: ["today"],
        negated: ["createdDate"],
      }),
    );
    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(undefined, "project-1"),
      { wrapper: Wrapper },
    );
    expect(result.current.filterTasks([task])).toEqual([]);
    expect(result.current.activeFilterCount).toBe(1);
    act(() => result.current.clearFilters());
    expect(result.current.filterTasks([task])).toEqual([task]);
    expect(result.current.activeFilterCount).toBe(0);
    expect(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "{}").createdDate,
    ).toBeNull();
  });

  it("refreshes a Today filter at local midnight without user interaction", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 23, 59, 59));
    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(undefined, "project-1"),
      { wrapper: Wrapper },
    );
    act(() => result.current.updateFilter("createdDate", ["today"]));
    expect(result.current.filterTasks([task])).toEqual([task]);
    act(() => vi.advanceTimersByTime(1001));
    expect(result.current.filterTasks([task])).toEqual([]);
  });
});
