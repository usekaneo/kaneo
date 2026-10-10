import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type SubtaskRow from "./subtask-row";
import { TaskProgressBadges } from "./task-progress-badges";
import TaskSubtasks from "./task-subtasks";

const mocks = vi.hoisted(() => ({
  canCreateTasks: vi.fn(),
  canUpdateTasks: vi.fn(),
  createTask: vi.fn(),
  createRelation: vi.fn(),
  getColumns: vi.fn(),
  getRelations: vi.fn(),
  fetchColumns: vi.fn(),
  updateStatus: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
  deleteRelation: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: unknown }) => children,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/task/use-create-task", () => ({
  default: () => ({ mutateAsync: mocks.createTask, isPending: false }),
}));
vi.mock("@/hooks/mutations/task-relation/use-create-task-relation", () => ({
  default: () => ({ mutateAsync: mocks.createRelation }),
}));
vi.mock("@/hooks/mutations/task-relation/use-delete-task-relation", () => ({
  default: () => ({ mutateAsync: mocks.deleteRelation, isPending: false }),
}));
vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: mocks.updateStatus }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => mocks.getColumns(),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => mocks.getRelations(),
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
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: mocks.canCreateTasks,
    canUpdateTasks: mocks.canUpdateTasks,
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock("./subtask-link-picker", () => ({
  default: ({ direction }: { direction: "parent" | "child" }) => (
    <div role="dialog" aria-label={`Choose ${direction}`} />
  ),
}));

beforeEach(() => {
  mocks.getRelations.mockReturnValue({ data: [] });
  mocks.canCreateTasks.mockReturnValue(true);
  mocks.canUpdateTasks.mockReturnValue(true);
  mocks.getColumns.mockReturnValue({
    data: [
      { id: "todo", slug: "to-do", name: "To Do", isFinal: false },
      { id: "done", slug: "done", name: "Done", isFinal: true },
    ],
    isLoading: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskSubtasks", () => {
  it("replaces parent selection with unlink and restores it after unlinking", async () => {
    const parent = {
      id: "relation",
      relationType: "subtask",
      sourceTaskId: "parent",
      targetTaskId: "child",
      sourceTask: { id: "parent", title: "Parent", projectId: "project-2" },
    };
    mocks.getRelations.mockReturnValue({ data: [parent] });
    mocks.deleteRelation.mockResolvedValue(undefined);
    const view = render(
      <TaskSubtasks
        taskId="child"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.chooseParent" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tasks:subtasks.unlinkParent" }),
    ).toHaveTextContent("tasks:subtasks.unlinkParent");
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.unlinkParent" }),
    );
    await waitFor(() =>
      expect(mocks.deleteRelation).toHaveBeenCalledWith("relation"),
    );
    mocks.getRelations.mockReturnValue({ data: [] });
    view.rerender(
      <TaskSubtasks
        taskId="child"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );
    expect(
      screen.getByRole("button", { name: "tasks:subtasks.chooseParent" }),
    ).toBeVisible();
  });

  it("keeps the parent linked and reports an unlink failure", async () => {
    mocks.getRelations.mockReturnValue({
      data: [
        {
          id: "relation",
          relationType: "subtask",
          sourceTaskId: "parent",
          targetTaskId: "child",
          sourceTask: { id: "parent", title: "Parent", projectId: "project-2" },
        },
      ],
    });
    mocks.deleteRelation.mockRejectedValueOnce(new Error("Unlink failed"));
    render(
      <TaskSubtasks
        taskId="child"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.unlinkParent" }),
    );
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Unlink failed"),
    );
    expect(
      screen.getByRole("button", { name: "tasks:subtasks.unlinkParent" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.chooseParent" }),
    ).not.toBeInTheDocument();
  });
  it("opens the parent picker from the subtask section", () => {
    render(
      <TaskSubtasks
        taskId="child"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.chooseParent" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Choose parent" }),
    ).toBeInTheDocument();
  });
  it("allows linking existing tasks without task-create permission", () => {
    mocks.canCreateTasks.mockReturnValue(false);
    render(
      <TaskSubtasks
        taskId="parent-1"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );
    expect(
      screen.getByRole("button", { name: "tasks:subtasks.addExisting" }),
    ).toBeEnabled();
  });

  it("hides linking without task-update permission", () => {
    mocks.canUpdateTasks.mockReturnValue(false);
    render(
      <TaskSubtasks
        taskId="parent-1"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.addExisting" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.chooseParent" }),
    ).not.toBeInTheDocument();
  });

  it("creates a subtask as planned when its parent is planned", async () => {
    mocks.createTask.mockResolvedValue({ id: "subtask-1" });
    mocks.createRelation.mockResolvedValue({});

    render(
      <TaskSubtasks
        taskId="parent-1"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "tasks:subtasks.addAction tasks:subtasks.title",
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("tasks:subtasks.inputPlaceholder"),
      {
        target: { value: "Design login form" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.addAction" }),
    );

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledTimes(1));
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "planned" }),
    );
  });

  it("uses the project's first active column for an active parent", async () => {
    mocks.createTask.mockResolvedValue({ id: "subtask-2" });
    mocks.createRelation.mockResolvedValue({});

    render(
      <TaskSubtasks
        taskId="parent-2"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="in-progress"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "tasks:subtasks.addAction tasks:subtasks.title",
      }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("tasks:subtasks.inputPlaceholder"),
      {
        target: { value: "Implement login form" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.addAction" }),
    );

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledTimes(1));
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "to-do" }),
    );
  });

  it("blocks active-parent creation until project columns are available", () => {
    mocks.getColumns.mockReturnValue({ data: [], isLoading: true });

    render(
      <TaskSubtasks
        taskId="parent-3"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="in-progress"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "tasks:subtasks.addAction tasks:subtasks.title",
      }),
    ).toBeDisabled();
  });

  it("hides subtask creation without task-create permission", () => {
    mocks.canCreateTasks.mockReturnValue(false);

    render(
      <TaskSubtasks
        taskId="parent-4"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus="planned"
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "tasks:subtasks.addAction tasks:subtasks.title",
      }),
    ).not.toBeInTheDocument();
  });
});

vi.mock("@/fetchers/column/get-columns", () => ({
  default: (projectId: string) => mocks.fetchColumns(projectId),
}));
vi.mock("./subtask-row", () => ({
  default: ({
    isCompleted,
    onToggleComplete,
    onNavigate,
    onUnlink,
  }: ComponentProps<typeof SubtaskRow>) => (
    <>
      <button
        type="button"
        aria-label="Toggle child"
        aria-pressed={isCompleted}
        onClick={onToggleComplete}
      >
        Toggle
      </button>
      <button type="button" onClick={onNavigate}>
        Open child
      </button>
      <button type="button" onClick={onUnlink}>
        Unlink child
      </button>
    </>
  ),
}));
function renderCrossProjectChild(isCompleted: boolean) {
  mocks.getRelations.mockReturnValue({
    data: [
      {
        id: "relation",
        relationType: "subtask",
        sourceTaskId: "parent",
        targetTaskId: "child",
        targetTask: {
          id: "child",
          projectId: "child-project",
          title: "Child",
          status: isCompleted ? "shipped" : "queued",
          isCompleted,
        },
      },
    ],
  });
  return render(
    <>
      <TaskProgressBadges
        task={{
          description: null,
          subtaskCounts: { completed: isCompleted ? 1 : 0, total: 1 },
        }}
        asText
      />
      <TaskSubtasks
        taskId="parent"
        projectId="parent-project"
        workspaceId="workspace-1"
        parentStatus="to-do"
      />
    </>,
  );
}
describe("cross-project subtask progress", () => {
  it("unlinks an existing child without deleting the task", async () => {
    mocks.deleteRelation.mockResolvedValue({});
    renderCrossProjectChild(false);
    fireEvent.click(screen.getByRole("button", { name: "Unlink child" }));
    await waitFor(() =>
      expect(mocks.deleteRelation).toHaveBeenCalledWith("relation"),
    );
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "agrees with the board for completion=%s in a different workflow",
    (completed) => {
      renderCrossProjectChild(completed);
      expect(screen.getAllByText(completed ? "1/1" : "0/1")).toHaveLength(2);
      expect(
        screen.getByRole("button", { name: "Toggle child" }),
      ).toHaveAttribute("aria-pressed", String(completed));
    },
  );
  it.each([true, false])(
    "toggles completion=%s using the child's columns",
    async (completed) => {
      mocks.fetchColumns.mockResolvedValue([
        { slug: "queued", isFinal: false },
        { slug: "shipped", isFinal: true },
      ]);
      renderCrossProjectChild(completed);
      fireEvent.click(screen.getByRole("button", { name: "Toggle child" }));
      await waitFor(() =>
        expect(mocks.updateStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "child",
            projectId: "child-project",
            status: completed ? "queued" : "shipped",
          }),
        ),
      );
      expect(mocks.fetchColumns).toHaveBeenCalledWith("child-project");
    },
  );
  it("does not invent a status when the workflow has no final column", async () => {
    mocks.fetchColumns.mockResolvedValue([{ slug: "queued", isFinal: false }]);
    renderCrossProjectChild(false);
    fireEvent.click(screen.getByRole("button", { name: "Toggle child" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "tasks:subtasks.noCompletionColumn",
      ),
    );
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });
  it("opens the child in its own project", () => {
    renderCrossProjectChild(true);
    fireEvent.click(screen.getByRole("button", { name: "Open child" }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          workspaceId: "workspace-1",
          projectId: "child-project",
          taskId: "child",
        },
      }),
    );
  });
});
