import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import TaskRow from "./task-row";

const useExternalLinks = vi.fn((_taskId: string) => ({ data: [] }));
const useGetLabelsByTask = vi.fn((_taskId: string) => ({ data: [] }));

afterEach(() => {
  cleanup();
  interpolations.length = 0;
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/queries/external-link/use-external-links", () => ({
  default: (taskId: string) => useExternalLinks(taskId),
}));

vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: (taskId: string) => useGetLabelsByTask(taskId),
}));

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock(
  "../kanban-board/task-card-context-menu/task-card-context-menu-content",
  () => ({ default: () => null }),
);

vi.mock("@/store/bulk-selection", () => ({
  default: () => ({
    toggleSelection: vi.fn(),
    isSelected: () => false,
    isFocused: () => false,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: { id: "project-1", slug: "kan" } }),
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({
    showAssignees: true,
    showDueDates: true,
    showLabels: true,
    showTaskNumbers: true,
  }),
}));

const interpolations: Record<string, unknown>[] = [];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) interpolations.push(options);
      return key;
    },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const task: Task = {
  id: "task-1",
  title: "Row from payload",
  number: 7,
  description: null,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-08-05T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
  labels: [{ id: "label-1", name: "Bug", color: "red" }],
  externalLinks: [
    {
      id: "link-1",
      taskId: "task-1",
      integrationId: "integration-1",
      resourceType: "pull_request",
      externalId: "42",
      url: "https://github.com/o/r/pull/42",
      title: "Fix it",
      metadata: { merged: false, draft: false },
    },
  ],
};

describe("TaskRow", () => {
  it("renders labels and pull requests from the task payload without per-row requests", () => {
    render(<TaskRow task={task} projectSlug="kan" />);

    expect(screen.getByText("Bug")).toBeVisible();
    expect(screen.getByText("#42")).toBeVisible();
    expect(useExternalLinks).not.toHaveBeenCalled();
    expect(useGetLabelsByTask).not.toHaveBeenCalled();
  });

  it("shows no subtask toggle when the task has no children", () => {
    render(<TaskRow task={task} projectSlug="kan" />);

    expect(
      screen.queryByLabelText("tasks:listView.expandSubtasks"),
    ).not.toBeInTheDocument();
  });

  it("keeps the subtask toggle outside the drag activator", () => {
    render(
      <TaskRow
        task={task}
        projectSlug="kan"
        rowId="parent/task-1"
        depth={1}
        childCount={2}
        onToggleExpanded={vi.fn()}
      />,
    );

    const toggle = screen.getByLabelText("tasks:listView.expandSubtasks");
    const activator = document.querySelector('[role="button"]');

    // dnd-kit gives its activator role="button". A button nested inside one is
    // an ambiguous control for assistive technology, so the toggle has to be a
    // sibling of the draggable region rather than a descendant.
    expect(activator).not.toBeNull();
    expect(activator?.contains(toggle)).toBe(false);
    expect(toggle.closest('[role="button"]')).toBeNull();
  });

  it("reserves the toggle column so titles stay aligned in a group", () => {
    const { container: withToggle } = render(
      <TaskRow
        task={task}
        projectSlug="kan"
        childCount={1}
        reserveToggleSpace
        onToggleExpanded={vi.fn()}
      />,
    );
    const { container: withoutToggle } = render(
      <TaskRow task={task} projectSlug="kan" reserveToggleSpace />,
    );

    const gutter = (root: HTMLElement) =>
      root.firstElementChild?.firstElementChild;

    // A row with no children still renders the column, so its number and title
    // start at the same offset as a sibling that does have one.
    expect(gutter(withToggle)).not.toBeNull();
    expect(gutter(withoutToggle)).not.toBeNull();
    expect(gutter(withoutToggle)?.className).toEqual(
      gutter(withToggle)?.className,
    );
  });

  it("keeps the original left edge when a group has no subtasks", () => {
    const { container } = render(<TaskRow task={task} projectSlug="kan" />);
    const draggable = container.querySelector('[role="button"]');

    expect(draggable?.className).toContain("pl-4");
  });

  it("announces the nesting level, which the indent cannot", () => {
    render(
      <TaskRow task={task} projectSlug="kan" rowId="a/b/task-1" depth={2} />,
    );

    // A nested repeat and its top-level row otherwise expose identical
    // content, so the hierarchy would be inaudible.
    expect(screen.getByText("tasks:listView.subtaskLevel")).toBeInTheDocument();
  });

  it("adds no level announcement to a top-level row", () => {
    render(<TaskRow task={task} projectSlug="kan" />);

    expect(
      screen.queryByText("tasks:listView.subtaskLevel"),
    ).not.toBeInTheDocument();
  });

  it("names the toggle by its task, not the action alone", () => {
    render(
      <TaskRow
        task={task}
        projectSlug="kan"
        childCount={1}
        onToggleExpanded={vi.fn()}
      />,
    );

    // Several rows each offering "Show subtasks" would be indistinguishable,
    // so the label interpolates the title.
    expect(interpolations).toContainEqual({ title: "Row from payload" });
  });

  it("does not announce a repeated row as disabled", () => {
    render(
      <TaskRow task={task} projectSlug="kan" rowId="parent/task-1" depth={1} />,
    );

    // The repeat is not a drag source, but it still opens its task, so the
    // aria-disabled dnd-kit puts on a disabled sortable must not reach it.
    const row = screen.getByRole("button", { name: /Row from payload/ });
    expect(row).not.toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("labels the toggle by its resulting state", () => {
    render(
      <TaskRow
        task={task}
        projectSlug="kan"
        childCount={1}
        isExpanded
        onToggleExpanded={vi.fn()}
      />,
    );

    const toggle = screen.getByLabelText("tasks:listView.collapseSubtasks");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
