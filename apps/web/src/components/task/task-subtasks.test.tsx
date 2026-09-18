import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskSubtasks from "./task-subtasks";

const checklist = (id: string, title: string | null, position = 0) => ({
  id,
  taskId: "parent",
  title,
  position,
  createdAt: "2026-09-19T00:00:00.000Z",
});

const item = (
  relationId: string,
  title: string,
  checklistId: string,
  position: number,
) => ({
  id: relationId,
  sourceTaskId: "parent",
  targetTaskId: `task-${relationId}`,
  relationType: "subtask",
  checklistId,
  position,
  createdAt: "2026-09-19T00:00:00.000Z",
  sourceTask: null,
  targetTask: {
    id: `task-${relationId}`,
    title,
    status: "to-do",
    priority: null,
    number: 1,
    projectId: "project-1",
    userId: null,
    assigneeName: null,
  },
});

function renderList(parentStatus = "in-progress", taskId = "parent") {
  return render(
    <TaskSubtasks
      taskId={taskId}
      projectId="project-1"
      workspaceId="workspace-1"
      parentStatus={parentStatus}
    />,
  );
}

function addItem(title: string) {
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:subtasks.addItem" }),
  );
  fireEvent.change(
    screen.getByPlaceholderText("tasks:subtasks.inputPlaceholder"),
    { target: { value: title } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:subtasks.addAction" }),
  );
}

const mocks = vi.hoisted(() => ({
  canCreateTasks: vi.fn(),
  canUpdateTasks: vi.fn(),
  createTask: vi.fn(),
  createRelation: vi.fn(),
  getColumns: vi.fn(),
  relations: vi.fn(),
  checklists: vi.fn(),
  createChecklist: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: unknown }) => children,
}));
// The row has its own popovers and animation; only its title matters here.
vi.mock("./subtask-row", () => ({
  default: ({ task }: { task: { title: string } }) => (
    <span className="truncate">{task.title}</span>
  ),
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
  default: () => ({ data: mocks.relations() }),
}));
vi.mock("@/hooks/checklist", () => {
  const idle = { mutate: vi.fn(), isPending: false };
  return {
    useChecklists: () => ({ data: mocks.checklists() }),
    useChecklistActions: () => ({
      create: { mutate: mocks.createChecklist, isPending: false },
      rename: idle,
      remove: idle,
      reorder: idle,
      setItems: idle,
    }),
  };
});
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
    canDeleteTasks: () => true,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  mocks.canCreateTasks.mockReturnValue(true);
  mocks.canUpdateTasks.mockReturnValue(true);
  mocks.relations.mockReturnValue([]);
  mocks.checklists.mockReturnValue([checklist("cl-1", null)]);
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

describe("TaskSubtasks (checklists)", () => {
  it("adds an item to its checklist as planned when the parent is planned", async () => {
    mocks.createTask.mockResolvedValue({ id: "subtask-1" });
    mocks.createRelation.mockResolvedValue({});
    renderList("planned");

    addItem("Design login form");

    await waitFor(() => expect(mocks.createRelation).toHaveBeenCalledTimes(1));
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "planned" }),
    );
    expect(mocks.createRelation).toHaveBeenCalledWith({
      sourceTaskId: "parent",
      targetTaskId: "subtask-1",
      relationType: "subtask",
      checklistId: "cl-1",
    });
  });

  it("uses the project's first active column for an active parent", async () => {
    mocks.createTask.mockResolvedValue({ id: "subtask-2" });
    mocks.createRelation.mockResolvedValue({});
    renderList("in-progress");

    addItem("Implement login form");

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledTimes(1));
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "to-do" }),
    );
  });

  it("can't add items to an active parent until project columns load", () => {
    mocks.getColumns.mockReturnValue({ data: [], isLoading: true });
    renderList("in-progress");
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.addItem" }),
    ).not.toBeInTheDocument();
  });

  it("hides adding items without task-create permission", () => {
    mocks.canCreateTasks.mockReturnValue(false);
    renderList("planned");
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.addItem" }),
    ).not.toBeInTheDocument();
  });

  it("shows each checklist with its own items, in order", () => {
    mocks.checklists.mockReturnValue([
      checklist("cl-1", null, 0),
      checklist("cl-2", "QA", 1),
    ]);
    mocks.relations.mockReturnValue([
      item("r3", "iOS test", "cl-2", 0),
      item("r2", "Colors", "cl-1", 1),
      item("r1", "Wireframe", "cl-1", 0),
    ]);
    renderList();

    const [first, second] = screen.getAllByRole("region");
    expect(first).toHaveAccessibleName("tasks:subtasks.defaultName");
    expect(second).toHaveAccessibleName("QA");
    const titles = (el: HTMLElement) =>
      [...el.querySelectorAll("span.truncate")].map((s) => s.textContent);
    expect(titles(first as HTMLElement)).toEqual(["Wireframe", "Colors"]);
    expect(titles(second as HTMLElement)).toEqual(["iOS test"]);
  });

  it("adds a named checklist", () => {
    renderList();
    fireEvent.click(
      screen.getByRole("button", { name: /tasks:subtasks.addChecklist/ }),
    );
    fireEvent.change(
      screen.getByPlaceholderText("tasks:subtasks.checklistNamePlaceholder"),
      { target: { value: "QA" } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText("tasks:subtasks.checklistNamePlaceholder"),
      { key: "Enter" },
    );
    expect(mocks.createChecklist).toHaveBeenCalledWith("QA", expect.anything());
  });
});
