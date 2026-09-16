import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import BacklogTaskRow from "./backlog-task-row";

const { useSortable } = vi.hoisted(() => ({
  useSortable: vi.fn((_options: { id: string }) => ({
    attributes: { role: "button" },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));
vi.mock("@dnd-kit/sortable", () => ({ useSortable }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
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
  "@/hooks/queries/custom-field/use-get-custom-field-values-by-project",
  () => ({
    default: () => ({ data: [] }),
  }),
);
vi.mock(
  "../kanban-board/task-card-context-menu/task-card-context-menu-content",
  () => ({
    default: () => null,
  }),
);
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({ showLabels: true, showTaskNumbers: true }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const task: Task = {
  id: "task-1",
  title: "First task",
  number: 1,
  description: null,
  status: "planned",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 0,
  createdAt: "2026-09-16T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
  labels: [],
};
const otherTask = { ...task, id: "task-2", title: "Second task" };

const project: ProjectWithTasks = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Imported project",
  slug: "IMP",
  icon: null,
  description: null,
  isPublic: false,
  columns: [],
  plannedTasks: [task, otherTask],
  archivedTasks: [],
};

beforeEach(() => {
  useProjectStore.setState({ project });
  useBacklogBulkSelectionStore.setState(
    useBacklogBulkSelectionStore.getInitialState(),
  );
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("backlog row subscriptions", () => {
  it("only renders the row whose selection changes, including deselection", () => {
    render(
      <>
        <BacklogTaskRow task={task} />
        <BacklogTaskRow task={otherTask} />
      </>,
    );
    useSortable.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /First task/ }), {
      ctrlKey: true,
    });
    expect(useSortable.mock.calls.map(([options]) => options.id)).toEqual([
      "task-1",
    ]);
    expect(screen.getByRole("button", { name: /First task/ })).toHaveClass(
      "bg-accent/45",
    );

    useSortable.mockClear();
    act(() => useBacklogBulkSelectionStore.getState().clearSelection());
    expect(useSortable.mock.calls.map(([options]) => options.id)).toEqual([
      "task-1",
    ]);
    expect(screen.getByRole("button", { name: /First task/ })).not.toHaveClass(
      "bg-accent/45",
    );
  });

  it("updates focus highlights without rendering rows on available-task changes", () => {
    render(
      <>
        <BacklogTaskRow task={task} />
        <BacklogTaskRow task={otherTask} />
      </>,
    );
    useSortable.mockClear();
    act(() =>
      useBacklogBulkSelectionStore
        .getState()
        .setAvailableTasks([task.id, otherTask.id]),
    );
    expect(useSortable).not.toHaveBeenCalled();

    act(() => useBacklogBulkSelectionStore.getState().focusNext());
    expect(useSortable.mock.calls.map(([options]) => options.id)).toEqual([
      "task-1",
    ]);
    expect(
      screen.getByRole("button", { name: /First task/ }).closest(".ring-2"),
    ).not.toBeNull();

    useSortable.mockClear();
    act(() => useBacklogBulkSelectionStore.getState().focusNext());
    expect(
      useSortable.mock.calls.map(([options]) => options.id).sort(),
    ).toEqual(["task-1", "task-2"]);
    expect(
      screen.getByRole("button", { name: /First task/ }).closest(".ring-2"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Second task/ }).closest(".ring-2"),
    ).not.toBeNull();
  });

  it("ignores unrelated project updates but keeps task numbers in sync with the slug", () => {
    render(
      <>
        <BacklogTaskRow task={task} />
        <BacklogTaskRow task={otherTask} />
      </>,
    );
    useSortable.mockClear();
    act(() =>
      useProjectStore
        .getState()
        .setProject({ ...project, description: "Updated description" }),
    );
    expect(useSortable).not.toHaveBeenCalled();
    act(() =>
      useProjectStore.getState().setProject({ ...project, slug: "NEW" }),
    );
    expect(
      useSortable.mock.calls.map(([options]) => options.id).sort(),
    ).toEqual(["task-1", "task-2"]);
    expect(screen.getAllByText("NEW-1")).toHaveLength(2);
  });

  it("skips unchanged task props but renders refreshed task data", () => {
    const { rerender } = render(<BacklogTaskRow task={task} />);
    useSortable.mockClear();
    rerender(<BacklogTaskRow task={task} />);
    expect(useSortable).not.toHaveBeenCalled();
    rerender(
      <BacklogTaskRow
        task={{
          ...task,
          title: "Updated title",
          labels: [{ id: "label-1", name: "Bug", color: "red" }],
        }}
      />,
    );
    expect(screen.getByText("Updated title")).toBeVisible();
    expect(screen.getByText("Bug")).toBeVisible();
  });
});
