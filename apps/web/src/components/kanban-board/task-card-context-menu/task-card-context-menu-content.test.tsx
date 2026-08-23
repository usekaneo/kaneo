import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "./task-card-context-menu-content";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: [],
  }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: { members: [] },
    }),
  }),
);

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-assignee", () => ({
  useUpdateTaskAssignee: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-description", () => ({
  useUpdateTaskDescription: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-due-date", () => ({
  useUpdateTaskDueDate: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-status-priority", () => ({
  useUpdateTaskPriority: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageTasks: () => true,
    canAssignTasks: () => true,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({
    project: {
      columns: [],
    },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const task: Task = {
  id: "task-1",
  title: "Test task",
  number: 1,
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
};

const taskCardContext = {
  projectId: "project-1",
  worskpaceId: "workspace-1",
};

function renderContextMenu(testTask: Task) {
  render(
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div data-testid="trigger">Open menu</div>
      </ContextMenuTrigger>

      <TaskCardContextMenuContent
        task={testTask}
        taskCardContext={taskCardContext}
        onDeleteClick={vi.fn()}
      />
    </ContextMenu>,
  );

  fireEvent.contextMenu(screen.getByTestId("trigger"));
}

describe("TaskCardContextMenuContent", () => {
  it("hides Mark as planned for planned tasks", async () => {
    renderContextMenu({
      ...task,
      status: "planned",
    });

    expect(
      await screen.queryByText("tasks:actions.markAsPlanned"),
    ).not.toBeInTheDocument();
  });

  it("shows Mark as planned for tasks that are not planned", async () => {
    renderContextMenu(task);

    expect(
      await screen.findByText("tasks:actions.markAsPlanned"),
    ).toBeInTheDocument();
  });
});
