import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskSubtasks from "./task-subtasks";

const mocks = vi.hoisted(() => ({
  canCreateTasks: vi.fn(),
  canUpdateTasks: vi.fn(),
  createTask: vi.fn(),
  createRelation: vi.fn(),
  getColumns: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
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
vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => mocks.getColumns(),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => ({ data: [] }),
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
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
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
      { target: { value: "Design login form" } },
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
      { target: { value: "Implement login form" } },
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
