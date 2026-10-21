import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

const root = { id: "root-label", name: "Bug", color: "red" };
const task: Task = {
  id: "task-1",
  title: "A new bug",
  number: 1,
  description: null,
  status: "to-do",
  priority: "low",
  startDate: null,
  dueDate: null,
  position: 0,
  createdAt: "2026-10-01T00:00:00Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
  labels: [],
};
const project: ProjectWithTasks = {
  id: "project-1",
  workspaceId: "workspace-1",
  slug: "TEST",
  name: "Test",
  description: null,
  icon: null,
  isPublic: false,
  plannedTasks: [],
  archivedTasks: [],
  columns: [
    {
      id: "to-do",
      slug: "to-do",
      name: "To do",
      icon: null,
      isFinal: false,
      tasks: [task],
    },
  ],
};

afterEach(() => window.localStorage.clear());

describe("saved label filters", () => {
  it.each([false, true])(
    "updates new assignments with negation=%s",
    async (negated) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });
      client.setQueryData(["labels", "workspace-1"], [root]);
      window.localStorage.setItem(
        "kaneo:board-filters:project-1",
        JSON.stringify({
          labels: [root.id],
          negated: negated ? ["labels"] : null,
        }),
      );
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result, rerender } = renderHook(
        ({ current }) => useTaskFiltersWithLabelsSupport(current, current.id),
        { wrapper, initialProps: { current: project } },
      );
      await waitFor(() => {
        expect(result.current.filterTasks([task])).toHaveLength(
          negated ? 1 : 0,
        );
      });

      const attached = { ...root, id: "new-task-label" };
      const updatedTask = { ...task, labels: [attached] };
      act(() => {
        client.setQueryData(["labels", "workspace-1"], [root, attached]);
      });
      rerender({
        current: {
          ...project,
          columns: [{ ...project.columns[0], tasks: [updatedTask] }],
        },
      });
      await waitFor(() => {
        expect(result.current.filterTasks([updatedTask])).toHaveLength(
          negated ? 0 : 1,
        );
      });
      expect(result.current.storedFilters.labels).toEqual([root.id]);
      expect(result.current.filters.labels).toContain(attached.id);
      expect(
        JSON.parse(
          window.localStorage.getItem("kaneo:board-filters:project-1") ?? "{}",
        ).labels,
      ).toEqual([root.id]);
    },
  );
});
