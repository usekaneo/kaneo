import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useFilterSubjects } from "@/components/project/task-filters/use-filter-subjects";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

const root = {
  id: "root-label",
  name: "Bug",
  color: "red",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  taskId: null,
  workspaceId: "workspace-1",
};
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
      // Remote assignments patch the task before workspace label options refresh.
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
      expect(
        JSON.parse(
          window.localStorage.getItem("kaneo:board-filters:project-1") ?? "{}",
        ).labels,
      ).toEqual([root.id]);

      rerender({ current: project });
      expect(result.current.filterTasks([task])).toHaveLength(negated ? 1 : 0);
    },
  );

  it.each([
    ["red", "red"],
    ["#bb87fc", "#BB87FC"],
  ])(
    "can uncheck a remote %s/%s group with stale workspace options",
    (color, assignedColor) => {
      const label = { ...root, color };
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });
      client.setQueryData(["labels", "workspace-1"], [label]);
      window.localStorage.setItem(
        "kaneo:board-filters:project-1",
        JSON.stringify({ labels: [root.id] }),
      );
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const updatedTask = {
        ...task,
        labels: [{ ...label, color: assignedColor, id: "remote-copy" }],
      };
      const current = {
        ...project,
        columns: [{ ...project.columns[0], tasks: [updatedTask] }],
      };
      const { result } = renderHook(
        () => {
          const controls = useTaskFiltersWithLabelsSupport(current, current.id);
          const subjects = useFilterSubjects({
            controls,
            options: {
              labels: [label],
              members: [],
              customFields: [],
              usedCustomFieldValues: {},
            },
            tasks: [updatedTask],
            showStatus: false,
          });
          return {
            controls,
            labels: subjects.find((subject) => subject.id === "labels")!,
          };
        },
        { wrapper },
      );

      expect(result.current.controls.filterTasks([updatedTask])).toHaveLength(
        1,
      );
      expect(result.current.labels.options[0]?.count).toBe(1);
      act(() => result.current.labels.onToggle(root.id));
      expect(result.current.labels.selected).toEqual([]);
      expect(result.current.controls.filters.labels).toBeNull();
      expect(result.current.controls.hasActiveFilters).toBe(false);
    },
  );

  it("uses the current task metadata when a saved assignment is renamed", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["labels", "workspace-1"], [root]);
    window.localStorage.setItem(
      "kaneo:board-filters:project-1",
      JSON.stringify({ labels: [root.id] }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const renamedTask = { ...task, labels: [{ ...root, name: "Renamed" }] };
    const otherTask = {
      ...task,
      id: "other",
      labels: [{ ...root, id: "other-label" }],
    };
    const current = {
      ...project,
      columns: [{ ...project.columns[0], tasks: [renamedTask, otherTask] }],
    };
    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(current, current.id),
      { wrapper },
    );
    expect(result.current.filterTasks([renamedTask, otherTask])).toEqual([
      renamedTask,
    ]);
  });
});
