import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskEpicChildren from "./task-epic-children";

const mocks = vi.hoisted(() => ({
  canCreateTasks: vi.fn(),
  canUpdateTasks: vi.fn(),
  createTask: vi.fn(),
  createRelation: vi.fn(),
  getColumns: vi.fn(),
  getRelations: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
// Only AnimatePresence is stubbed; SubtaskRow renders real motion elements, so
// the rest of framer-motion has to stay intact.
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
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
// The rendered child rows pull in assignee/status popovers and the task context
// menu, which each check a different permission; everything this test does not
// drive is simply granted.
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () =>
    new Proxy(
      {
        canCreateTasks: mocks.canCreateTasks,
        canUpdateTasks: mocks.canUpdateTasks,
      } as Record<string, () => boolean>,
      {
        get: (target, property: string) => target[property] ?? (() => true),
      },
    ),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const addButtonName =
  "tasks:epics.children.addAction tasks:epics.children.title";

function childRelation(
  id: string,
  overrides: Partial<{ status: string; title: string }> = {},
) {
  return {
    id: `relation-${id}`,
    relationType: "epic",
    sourceTaskId: "epic-1",
    targetTaskId: id,
    targetTask: {
      id,
      title: overrides.title ?? `Child ${id}`,
      number: 1,
      status: overrides.status ?? "to-do",
      priority: "no-priority",
      userId: null,
      assigneeName: null,
      projectId: "project-1",
    },
  };
}

// SubtaskRow reaches for the query client through its assignee/status popovers.
function renderEpicChildren(parentStatus: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TaskEpicChildren
        taskId="epic-1"
        projectId="project-1"
        workspaceId="workspace-1"
        parentStatus={parentStatus}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.canCreateTasks.mockReturnValue(true);
  mocks.canUpdateTasks.mockReturnValue(true);
  mocks.getRelations.mockReturnValue({ data: [] });
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

describe("TaskEpicChildren", () => {
  it("links a new child to the epic with an epic-type relation", async () => {
    mocks.createTask.mockResolvedValue({ id: "child-1" });
    mocks.createRelation.mockResolvedValue({});

    renderEpicChildren("to-do");

    fireEvent.click(screen.getByRole("button", { name: addButtonName }));
    fireEvent.change(
      screen.getByPlaceholderText("tasks:epics.children.inputPlaceholder"),
      { target: { value: "Ship the new nav" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:epics.children.addAction" }),
    );

    await waitFor(() => expect(mocks.createRelation).toHaveBeenCalledTimes(1));
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "to-do" }),
    );
    expect(mocks.createRelation).toHaveBeenCalledWith({
      sourceTaskId: "epic-1",
      targetTaskId: "child-1",
      relationType: "epic",
    });
  });

  it("creates children as planned when the epic itself is planned", async () => {
    mocks.createTask.mockResolvedValue({ id: "child-2" });
    mocks.createRelation.mockResolvedValue({});

    renderEpicChildren("planned");

    fireEvent.click(screen.getByRole("button", { name: addButtonName }));
    fireEvent.change(
      screen.getByPlaceholderText("tasks:epics.children.inputPlaceholder"),
      { target: { value: "Groom the nav work" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:epics.children.addAction" }),
    );

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledTimes(1));
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "planned" }),
    );
  });

  it("counts children in a final column as complete", () => {
    mocks.getRelations.mockReturnValue({
      data: [
        childRelation("child-1", { status: "done" }),
        childRelation("child-2", { status: "to-do" }),
        childRelation("child-3", { status: "to-do" }),
      ],
    });

    renderEpicChildren("to-do");

    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("ignores relations that are not this epic's children", () => {
    mocks.getRelations.mockReturnValue({
      data: [
        childRelation("child-1"),
        { ...childRelation("child-2"), relationType: "blocks" },
        { ...childRelation("child-3"), sourceTaskId: "another-epic" },
      ],
    });

    renderEpicChildren("to-do");

    expect(screen.getByText("0/1")).toBeInTheDocument();
  });

  it("hides child creation without task-create permission", () => {
    mocks.canCreateTasks.mockReturnValue(false);

    renderEpicChildren("to-do");

    expect(
      screen.queryByRole("button", { name: addButtonName }),
    ).not.toBeInTheDocument();
  });
});
