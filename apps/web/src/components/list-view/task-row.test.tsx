import { DndContext, KeyboardSensor } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type Task from "@/types/task";
import useBulkSelectionStore from "@/store/bulk-selection";
import BacklogTaskRow from "../backlog-list-view/backlog-task-row";
import TaskCard from "../kanban-board/task-card";
import { PublicTaskCard } from "../public-project/task-card";
import { PublicTaskRow } from "../public-project/task-row";
import TaskRow from "./task-row";

const useExternalLinks = vi.fn((_taskId: string) => ({ data: [] }));
const useGetLabelsByTask = vi.fn((_taskId: string) => ({ data: [] }));
const { navigate } = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

beforeEach(() => {
  useBulkSelectionStore.setState(useBulkSelectionStore.getInitialState());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/queries/external-link/use-external-links", () => ({
  default: function useMockExternalLinks(taskId: string) {
    return useExternalLinks(taskId);
  },
}));

vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: function useMockTaskLabels(taskId: string) {
    return useGetLabelsByTask(taskId);
  },
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
  () => ({
    default: () => null,
  }),
);

vi.mock("@/store/project", () => ({
  default: (
    selector?: (state: {
      project: { id: string; slug: string; columns: never[] };
    }) => unknown,
  ) => {
    const state = { project: { id: "project-1", slug: "kan", columns: [] } };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({
    showAssignees: true,
    showDueDates: true,
    showLabels: true,
    showTaskNumbers: true,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
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
  subtaskCounts: { completed: 2, total: 5 },
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
  it.each(["board", "list"])(
    "selects a range with Shift+Enter in the %s view",
    (view) => {
      useBulkSelectionStore.getState().setAvailableTasks(["anchor", task.id]);
      useBulkSelectionStore.getState().setSelectionAnchor("anchor");
      const onDragStart = vi.fn();
      render(
        <DndContext
          sensors={[{ sensor: KeyboardSensor, options: {} }]}
          onDragStart={onDragStart}
        >
          {view === "board" ? (
            <TaskCard task={task} />
          ) : (
            <TaskRow task={task} projectSlug="kan" />
          )}
        </DndContext>,
      );

      fireEvent.keyDown(
        screen.getByRole("button", { name: /Row from payload/ }),
        {
          key: "Enter",
          shiftKey: true,
        },
      );

      expect(useBulkSelectionStore.getState().selectedTaskIds).toEqual(
        new Set(["anchor", task.id]),
      );
      expect(navigate).not.toHaveBeenCalled();
      expect(onDragStart).not.toHaveBeenCalled();

      fireEvent.keyDown(
        screen.getByRole("button", { name: /Row from payload/ }),
        { key: "Enter" },
      );
      expect(navigate).toHaveBeenCalled();
      expect(onDragStart).not.toHaveBeenCalled();
      fireEvent.keyDown(
        screen.getByRole("button", { name: /Row from payload/ }),
        { key: " ", code: "Space" },
      );
      expect(onDragStart).toHaveBeenCalledOnce();
    },
  );

  it.each(["board", "list"])(
    "selects a visible range with Shift+click and preserves Ctrl/Cmd toggling in the %s view",
    (view) => {
      const otherTask = { ...task, id: "task-2", title: "Second task" };
      useBulkSelectionStore
        .getState()
        .setAvailableTasks([task.id, "middle", otherTask.id]);
      render(
        <>
          {view === "board" ? (
            <TaskCard task={task} />
          ) : (
            <TaskRow task={task} projectSlug="kan" />
          )}
          {view === "board" ? (
            <TaskCard task={otherTask} />
          ) : (
            <TaskRow task={otherTask} projectSlug="kan" />
          )}
        </>,
      );
      fireEvent.click(screen.getByText(task.title));
      expect(navigate).toHaveBeenCalled();
      navigate.mockClear();
      fireEvent.click(screen.getByText(otherTask.title), { shiftKey: true });
      expect(useBulkSelectionStore.getState().selectedTaskIds).toEqual(
        new Set([task.id, "middle", otherTask.id]),
      );
      expect(navigate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText(task.title), { ctrlKey: true });
      fireEvent.click(screen.getByText(otherTask.title), { metaKey: true });
      expect(useBulkSelectionStore.getState().selectedTaskIds).toEqual(
        new Set(["middle"]),
      );
      expect(navigate).not.toHaveBeenCalled();
    },
  );

  it.each([PublicTaskCard, PublicTaskRow])(
    "renders public progress without nesting interactive controls",
    (Component) => {
      const onTaskClick = vi.fn();
      const { container } = render(
        <Component
          task={{ ...task, externalLinks: [] }}
          projectSlug="kan"
          onTaskClick={onTaskClick}
        />,
      );
      expect(screen.getByTitle("tasks:subtasks.progress")).toHaveTextContent(
        "2/5",
      );
      expect(container.querySelector("button button")).toBeNull();
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(useExternalLinks).not.toHaveBeenCalled();
      expect(useGetLabelsByTask).not.toHaveBeenCalled();
    },
  );

  it.each(["planned", "archived"])(
    "renders progress for %s backlog parents without per-row requests",
    (status) => {
      render(<BacklogTaskRow task={{ ...task, status }} />);

      expect(
        screen.getByRole("button", { name: "tasks:subtasks.progress" }),
      ).toHaveTextContent("2/5");
      expect(useExternalLinks).not.toHaveBeenCalled();
      expect(useGetLabelsByTask).not.toHaveBeenCalled();
    },
  );

  it("renders labels and pull requests from the task payload without per-row requests", () => {
    render(<TaskRow task={task} projectSlug="kan" />);

    expect(screen.getByText("Bug")).toBeVisible();
    expect(screen.getByText("#42")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "tasks:subtasks.progress" }),
    ).toHaveTextContent("2/5");
    expect(useExternalLinks).not.toHaveBeenCalled();
    expect(useGetLabelsByTask).not.toHaveBeenCalled();
  });
});

vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-field-values-by-project",
  () => ({
    default: () => ({ data: [] }),
  }),
);
