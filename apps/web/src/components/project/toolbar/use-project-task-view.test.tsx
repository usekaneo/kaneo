import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import {
  useProjectTaskView,
  type TaskViewScope,
} from "./use-project-task-view";

const state = vi.hoisted(() => ({ includeSubtasks: false }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/use-description-matches", () => ({
  useDescriptionMatches: () => ({ ids: new Set() }),
}));
vi.mock("@/hooks/use-task-filters-with-labels-support", () => ({
  useTaskFiltersWithLabelsSupport: () => ({
    includeSubtasks: state.includeSubtasks,
    filters: { priority: ["high"] },
    filteredProject: null,
    toggleFilter: vi.fn(),
    updateFilter: vi.fn(),
    setNegated: vi.fn(),
  }),
}));
vi.mock("@/components/project/task-filters/use-task-filter-options", () => ({
  useTaskFilterOptions: () => ({
    members: [{ userId: "member", user: { name: "Member" } }],
    labels: [{ id: "label", name: "Label", color: "red" }],
    customFields: [],
    usedCustomFieldValues: {},
  }),
}));
afterEach(() => {
  state.includeSubtasks = false;
});

const task = (id: string, priority: string, isSubtask = false) =>
  ({
    id,
    title: id,
    priority,
    isSubtask,
    status: "todo",
    userId: "member",
    labels: [{ id: "label", name: "Label", color: "red" }],
  }) as Task;
const tasks = (prefix: string) => [
  task(`${prefix}-parent`, "high"),
  task(`${prefix}-other`, "low"),
  task(`${prefix}-child`, "high", true),
];
const project = {
  id: "project",
  columns: [
    { id: "todo", name: "Todo", isFinal: false, tasks: tasks("board") },
  ],
  plannedTasks: tasks("planned"),
  archivedTasks: tasks("archived"),
} as unknown as ProjectWithTasks;

it.each<[TaskViewScope, number]>([
  ["board", 1],
  ["backlog", 2],
  ["schedule", 2],
])(
  "counts only displayed task types in %s, independently of selected filters and search",
  (scope, groups) => {
    const { result, rerender } = renderHook(() =>
      useProjectTaskView({
        project,
        projectId: "project",
        workspaceId: "workspace",
        scope,
      }),
    );
    const count = (subject: string, value: string) =>
      result.current.subjects
        .find((item) => item.id === subject)
        ?.options.find((option) => option.value === value)?.count;
    expect(count("priority", "high")).toBe(groups);
    expect(count("priority", "low")).toBe(groups);
    expect(count("assignee", "member")).toBe(groups * 2);
    expect(count("labels", "label")).toBe(groups * 2);
    if (scope !== "backlog") expect(count("status", "todo")).toBe(groups * 2);
    act(() => result.current.setSearch("nothing matches"));
    expect(count("priority", "low")).toBe(groups);
    state.includeSubtasks = true;
    rerender();
    expect(count("priority", "high")).toBe(groups * 2);
    expect(count("priority", "low")).toBe(groups);
    expect(count("assignee", "member")).toBe(groups * 3);
    expect(count("labels", "label")).toBe(groups * 3);
    if (scope !== "backlog") expect(count("status", "todo")).toBe(groups * 3);
    state.includeSubtasks = false;
    rerender();
    expect(count("priority", "high")).toBe(groups);
  },
);
