import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "./task-card-context-menu-content";

const duplicateTask = vi.fn();
const canCreateTasks = vi.fn(() => true);

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
  canCreateTasks.mockReturnValue(true);
});

vi.mock("@/hooks/mutations/task/use-duplicate-task", () => ({
  useDuplicateTask: () => ({ mutate: duplicateTask }),
}));

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

vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: [] }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks,
    canUpdateTasks: () => true,
    canDeleteTasks: () => true,
    canAssignTasks: () => true,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: { id: "project-1", slug: "kan", columns: [] } }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) =>
      options?.title ? `${key}|${options.title}` : key,
  }),
}));

const task: Task = {
  id: "task-1",
  title: "Release checklist",
  number: 4,
  description: null,
  status: "to-do",
  priority: "high",
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-08-05T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
};

function renderMenu() {
  render(
    <ContextMenu>
      <ContextMenuTrigger>
        <button type="button">Card</button>
      </ContextMenuTrigger>
      <TaskCardContextMenuContent
        task={task}
        taskCardContext={{ projectId: "project-1", worskpaceId: "workspace-1" }}
        onDeleteClick={vi.fn()}
      />
    </ContextMenu>,
  );

  fireEvent.contextMenu(screen.getByRole("button", { name: "Card" }));
}

describe("TaskCardContextMenuContent", () => {
  it("duplicates the task with the copy suffix applied to its title", async () => {
    renderMenu();

    const duplicateItem = await screen.findByText("tasks:actions.duplicate");
    fireEvent.click(duplicateItem);

    expect(duplicateTask).toHaveBeenCalledWith({
      taskId: "task-1",
      title: "tasks:duplicate.titleSuffix|Release checklist",
    });
  });

  it("hides the duplicate action from users who cannot create tasks", async () => {
    canCreateTasks.mockReturnValue(false);
    renderMenu();

    expect(await screen.findByText("tasks:actions.archive")).toBeVisible();
    expect(screen.queryByText("tasks:actions.duplicate")).toBeNull();
  });
});
