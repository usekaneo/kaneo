import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDescriptionMatches } from "@/fetchers/task/get-description-matches";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { addLabelToTaskInTasksCache } from "../../mutations/label/sync-task-labels-cache";
import { useTaskFiltersWithLabelsSupport } from "../../use-task-filters-with-labels-support";
import { useDescriptionMatches } from "./use-description-matches";

vi.mock("@/fetchers/task/get-description-matches", () => ({
  getDescriptionMatches: vi.fn(),
}));
const task: Task = {
  id: "deferred",
  projectId: "project",
  title: "Other title",
  number: 1,
  description: null,
  descriptionDeferred: true,
  status: "to-do",
  priority: "high",
  startDate: null,
  dueDate: null,
  position: 0,
  createdAt: "2026-01-01T00:00:00Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
};
const project: ProjectWithTasks = {
  id: "project",
  name: "Project",
  slug: "PRJ",
  icon: null,
  description: null,
  isPublic: false,
  workspaceId: "workspace",
  columns: [
    {
      id: "to-do",
      slug: "to-do",
      name: "To do",
      icon: null,
      isFinal: false,
      tasks: [
        task,
        {
          ...task,
          id: "local",
          descriptionDeferred: false,
          description: "needle",
        },
      ],
    },
  ],
  plannedTasks: [],
  archivedTasks: [],
};
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe("deferred description search", () => {
  it("combines full-text matches with local matches while preserving other filters", async () => {
    vi.mocked(getDescriptionMatches).mockResolvedValue(["deferred"]);
    const { result } = renderHook(
      () => {
        const matches = useDescriptionMatches("project", project, "needle");
        return useTaskFiltersWithLabelsSupport(
          project,
          "project",
          "needle",
          matches.ids,
        );
      },
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(result.current.filteredProject?.columns[0].tasks).toHaveLength(2),
    );
    act(() => result.current.updateFilter("priority", ["low"]));
    expect(result.current.filteredProject?.columns[0].tasks).toHaveLength(0);
  });
  it("refreshes matches on the existing board invalidation prefix", async () => {
    vi.mocked(getDescriptionMatches)
      .mockResolvedValueOnce(["deferred"])
      .mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useDescriptionMatches("project", project, "needle"),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.ids.has("deferred")).toBe(true));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["tasks", "project"] });
    });
    await waitFor(() => expect(result.current.ids.size).toBe(0));
    expect(getDescriptionMatches).toHaveBeenCalledTimes(2);
  });
  it("does not reuse another query's IDs, exposes search errors and supports retry", async () => {
    vi.mocked(getDescriptionMatches)
      .mockResolvedValueOnce(["deferred"])
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(
      ({ text }) => useDescriptionMatches("project", project, text),
      { initialProps: { text: "needle" }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.ids.size).toBe(1));
    rerender({ text: "other" });
    expect(result.current.ids.size).toBe(0);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isError).toBe(true));
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.isError).toBe(false));
  });
  it("keeps search caches separate when labels are updated optimistically", () => {
    client.setQueryData(["tasks", "project"], project);
    client.setQueryData(
      ["tasks", "project", "description-matches", "needle"],
      ["deferred"],
    );
    addLabelToTaskInTasksCache(client, "deferred", {
      id: "label",
      name: "Label",
      color: "red",
    });
    expect(
      client.getQueryData([
        "tasks",
        "project",
        "description-matches",
        "needle",
      ]),
    ).toEqual(["deferred"]);
    expect(
      client.getQueryData<ProjectWithTasks>(["tasks", "project"])?.columns[0]
        .tasks[0].labels,
    ).toEqual([{ id: "label", name: "Label", color: "red" }]);
  });
  it("does not search empty queries, ordinary-only boards or stale project stores", () => {
    renderHook(() => useDescriptionMatches("project", project, "  "), {
      wrapper: Wrapper,
    });
    renderHook(
      () => useDescriptionMatches("other-project", project, "needle"),
      { wrapper: Wrapper },
    );
    renderHook(
      () =>
        useDescriptionMatches("project", { ...project, columns: [] }, "needle"),
      { wrapper: Wrapper },
    );
    expect(getDescriptionMatches).not.toHaveBeenCalled();
  });
});
