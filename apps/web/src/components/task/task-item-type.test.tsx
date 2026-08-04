import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import type Task from "@/types/task";
import TaskItemTypePopover from "./task-item-type-popover";

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  itemTypes: [] as Array<{
    id: string;
    workspaceId: string;
    key: string;
    name: string;
    icon: string;
    description: string | null;
    position: number;
    archivedAt: string | null;
  }>,
  updateTask: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({
    pathname: "/dashboard/workspace/workspace-1/project/project-1",
  }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const values: Record<string, string> = {
        "common:modals.createTask.createButton": "Create task",
        "common:modals.createTask.taskTitlePlaceholder": "Task title",
        "tasks:properties.type": "Type",
        "tasks:properties.defaultType": "Task",
        "tasks:properties.archivedType": "Archived",
      };
      return options?.defaultValue ?? values[key] ?? key;
    },
  }),
}));

vi.mock("@/components/task/task-description-editor", () => ({
  default: () => <div data-testid="description-editor" />,
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

vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: [] }),
}));

vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-create-task", () => ({
  default: () => ({ mutateAsync: mocks.createTask }),
}));

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: mocks.deleteTask }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: mocks.updateTask }),
}));

vi.mock("@/hooks/queries/item-type/use-get-item-types", () => ({
  default: () => ({ data: mocks.itemTypes }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => true,
    canManageLabels: () => true,
    canManageTasks: () => true,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({
    project: { id: "project-1", slug: "PROJ", columns: [] },
    setProject: vi.fn(),
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), message: vi.fn(), success: vi.fn() },
}));

const task: Task = {
  id: "task-1",
  title: "Existing task",
  number: 1,
  description: null,
  status: "to-do",
  priority: "no-priority",
  startDate: null,
  dueDate: null,
  position: 0,
  createdAt: "2026-08-03T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
};

const activeTypes = [
  {
    id: "type-bug",
    workspaceId: "workspace-1",
    key: "bug",
    name: "Bug",
    icon: "bug",
    description: "Something broken",
    position: 1,
    archivedAt: null,
  },
  {
    id: "type-story",
    workspaceId: "workspace-1",
    key: "story",
    name: "Story",
    icon: "bookmark",
    description: "User value",
    position: 2,
    archivedAt: null,
  },
];

describe("task item type controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.itemTypes = [];
    mocks.createTask.mockResolvedValue({ ...task, title: "Created task" });
    mocks.updateTask.mockResolvedValue(task);
  });

  afterEach(cleanup);

  it("keeps the create modal and payload unchanged when the workspace has no custom types", async () => {
    render(<CreateTaskModal open onClose={vi.fn()} projectId="project-1" />);

    expect(screen.queryByRole("button", { name: /^Type:/ })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Task title"), {
      target: { value: "Ordinary task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledTimes(1));
    expect(mocks.createTask.mock.calls[0]?.[0]).not.toHaveProperty(
      "itemTypeId",
    );
  });

  it("defaults to Task and only includes itemTypeId after selecting a custom type", async () => {
    mocks.itemTypes = activeTypes;
    render(<CreateTaskModal open onClose={vi.fn()} projectId="project-1" />);

    fireEvent.change(screen.getByPlaceholderText("Task title"), {
      target: { value: "Investigate failure" },
    });
    expect(screen.getByRole("button", { name: "Type: Task" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Type: Task" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bug" }));
    expect(
      screen
        .getByRole("button", { name: "Type: Bug" })
        .querySelector(".lucide-bug"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledTimes(1));
    expect(mocks.createTask.mock.calls[0]?.[0]).toMatchObject({
      title: "Investigate failure",
      itemTypeId: "type-bug",
    });
    expect(mocks.createTask.mock.calls[0]?.[0]).not.toHaveProperty(
      "itemTypeWorkspaceId",
    );
  });

  it("shows an archived assignment read-only while offering active replacements", async () => {
    mocks.itemTypes = activeTypes;
    render(
      <TaskItemTypePopover
        task={{ ...task, itemTypeId: "type-archived" }}
        workspaceId="workspace-1"
      />,
    );

    expect(screen.getByText("Archived")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Type: Archived" }));
    expect(await screen.findByRole("button", { name: "Bug" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Archived" })).toBeNull();
  });

  it("updates an existing task with the selected item type only", async () => {
    mocks.itemTypes = activeTypes;
    render(<TaskItemTypePopover task={task} workspaceId="workspace-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Type: Task" }));
    fireEvent.click(await screen.findByRole("button", { name: "Story" }));

    await waitFor(() => expect(mocks.updateTask).toHaveBeenCalledTimes(1));
    expect(mocks.updateTask).toHaveBeenCalledWith({
      ...task,
      itemTypeId: "type-story",
    });
    expect(mocks.updateTask.mock.calls[0]?.[0]).not.toHaveProperty(
      "itemTypeWorkspaceId",
    );
  });
});
