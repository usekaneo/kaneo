import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import TaskCard from "./task-card";
import TaskRow from "../list-view/task-row";
import BacklogTaskRow from "../backlog-list-view/backlog-task-row";

const navigate = vi.fn();
const dragStart = vi.fn();
const updatePriority = vi.fn(async () => {});
const updateAssignee = vi.fn(async () => {});
const updateDueDate = vi.fn(async () => {});
const updateTask = vi.fn(async () => {});
const attachLabel = vi.fn(async () => {});
const detachLabel = vi.fn(async () => {});
const loadTaskLabels = vi.fn();
let canEdit = true;
let canAssign = true;
let isMobile = false;

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile,
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: { onPointerDown: dragStart },
    setNodeRef: vi.fn(),
    transform: null,
  }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@/store/project", () => ({
  default: (
    selector?: (state: {
      project: {
        id: string;
        slug: string;
        columns: { id: string; slug: string; isFinal: boolean }[];
      };
    }) => unknown,
  ) => {
    const state = {
      project: {
        id: "project",
        slug: "PROJ",
        columns: [
          { id: "shared", slug: "shared", isFinal: true },
          { id: "shared", slug: "shared", isFinal: false },
        ],
      },
    };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    select?: (state: Record<string, unknown>) => unknown,
  ) => {
    const state = {
      showLabels: true,
      showPriority: true,
      showDueDates: true,
      showTaskNumbers: true,
      showAssignees: true,
      weekStartsOn: 1,
    };
    return select ? select(state) : state;
  },
}));
vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace", slug: "workspace" } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => canEdit,
    canAssignTasks: () => canAssign,
    canUpdateLabels: () => canEdit,
    canCreateLabels: () => canEdit,
  }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status-priority", () => ({
  useUpdateTaskPriority: () => ({ mutateAsync: updatePriority }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-assignee", () => ({
  useUpdateTaskAssignee: () => ({ mutateAsync: updateAssignee }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-due-date", () => ({
  useUpdateTaskDueDate: () => ({ mutateAsync: updateDueDate }),
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: updateTask }),
}));
vi.mock("@/hooks/mutations/label/use-attach-label-to-task", () => ({
  default: () => ({ mutateAsync: attachLabel }),
}));
vi.mock("@/hooks/mutations/label/use-detach-label-from-task", () => ({
  default: () => ({ mutateAsync: detachLabel }),
}));
vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: () => {
    loadTaskLabels();
    return {
      data: [{ id: "task-label", name: "Regression label", color: "red" }],
    };
  },
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({
    data: [
      {
        id: "workspace-label",
        name: "Regression label",
        color: "red",
        taskId: null,
      },
      { id: "other-label", name: "Other label", color: "blue", taskId: null },
    ],
  }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: [{ userId: "user", user: { name: "Alex", image: null } }],
      },
    }),
  }),
);
vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({
    data: [
      { id: "user", name: "Alex", email: "alex@example.com", image: null },
    ],
  }),
}));
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-field-values-by-project",
  () => ({ default: () => ({ data: [] }) }),
);
vi.mock("@/components/task/task-progress-badges", () => ({
  TaskProgressBadges: () => null,
}));
vi.mock("@/components/task/task-pull-requests", () => ({
  TaskPullRequests: () => null,
}));
vi.mock("./task-card-context-menu/task-card-context-menu-content", () => ({
  default: () => null,
}));

beforeEach(() => {
  canEdit = true;
  canAssign = true;
  isMobile = false;
  vi.clearAllMocks();
});
afterEach(cleanup);
const task: Task = {
  id: "task",
  title: "Open work",
  status: "shared",
  projectId: "project",
  number: 1,
  description: null,
  priority: "high",
  startDate: "2029-01-01T00:00:00Z",
  dueDate: "2030-01-01T00:00:00Z",
  position: 1,
  createdAt: "2026-10-01T00:00:00Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  labels: [{ id: "label", name: "Regression label", color: "red" }],
};

function renderCard(
  cardTask: Task = task,
  viewMode: "board" | "list" | "backlog" = "board",
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      {viewMode === "board" ? (
        <TaskCard task={cardTask} isFinalColumn={false} />
      ) : viewMode === "backlog" ? (
        <BacklogTaskRow task={cardTask} />
      ) : (
        <TaskRow task={cardTask} projectSlug="PROJ" />
      )}
    </QueryClientProvider>,
  );
  return {
    ...view,
    rerenderCard: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          {viewMode === "board" ? (
            <TaskCard task={{ ...cardTask }} isFinalColumn={false} />
          ) : viewMode === "backlog" ? (
            <BacklogTaskRow task={{ ...cardTask }} />
          ) : (
            <TaskRow task={{ ...cardTask }} projectSlug="PROJ" />
          )}
        </QueryClientProvider>,
      ),
  };
}

it("keeps details in the rendered open column despite a final column sharing its slug", () => {
  const view = render(<TaskCard task={task} isFinalColumn={false} />);
  expect(screen.getByText("Regression label")).toBeVisible();
  view.rerender(<TaskCard task={task} isFinalColumn />);
  expect(screen.queryByText("Regression label")).not.toBeInTheDocument();
  expect(screen.getByText("Open work")).toBeVisible();
});

it("keeps the parent indicator visible on completed task cards", () => {
  const child = {
    ...task,
    subtaskParents: [{ id: "parent", title: "Parent", projectId: "project-1" }],
  };
  const view = render(<TaskCard task={child} isFinalColumn />);
  expect(
    screen.getByRole("button", { name: "tasks:subtasks.parentIndicator" }),
  ).toBeVisible();
  view.rerender(
    <TaskCard task={{ ...child, subtaskParents: [] }} isFinalColumn />,
  );
  expect(
    screen.queryByRole("button", { name: "tasks:subtasks.parentIndicator" }),
  ).not.toBeInTheDocument();
});

it.each(["board", "list", "backlog"] as const)(
  "opens priority editing in %s without navigating or starting a drag and persists the selection",
  async (viewMode) => {
    renderCard(task, viewMode);
    expect(loadTaskLabels).not.toHaveBeenCalled();
    const trigger = screen.getByRole("button", { name: "High" });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /Low/,
      }),
    );
    await vi.waitFor(() =>
      expect(updatePriority).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          priority: "low",
        }),
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(dragStart).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "High" })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Open work"));
    expect(navigate).toHaveBeenCalledOnce();
  },
);

it.each(["board", "list", "backlog"] as const)(
  "exposes accessible controls for editable properties in %s",
  (viewMode) => {
    renderCard(task, viewMode);
    const assignee = screen.getByRole("button", {
      name: "tasks:boardFilters.subjects.assignee",
    });
    expect(assignee).toBeVisible();
    for (const name of [
      "High",
      "tasks:properties.labels",
      "tasks:properties.startDate",
      "tasks:boardFilters.subjects.dueDate",
    ]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
  },
);

it.each(["board", "list", "backlog"] as const)(
  "opens assignee editing in %s and supports assigning an unassigned task",
  async (viewMode) => {
    renderCard(task, viewMode);
    fireEvent.click(
      screen.getByRole("button", {
        name: "tasks:boardFilters.subjects.assignee",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /Alex/,
      }),
    );
    await vi.waitFor(() =>
      expect(updateAssignee).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          userId: "user",
        }),
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  },
);

it.each([
  [
    "tasks:properties.startDate",
    "tasks:popover.startDate.clear",
    updateTask,
    "startDate",
    "board",
  ],
  [
    "tasks:boardFilters.subjects.dueDate",
    "tasks:popover.dueDate.clear",
    updateDueDate,
    "dueDate",
    "board",
  ],
  [
    "tasks:properties.startDate",
    "tasks:popover.startDate.clear",
    updateTask,
    "startDate",
    "list",
  ],
  [
    "tasks:boardFilters.subjects.dueDate",
    "tasks:popover.dueDate.clear",
    updateDueDate,
    "dueDate",
    "list",
  ],
  [
    "tasks:properties.startDate",
    "tasks:popover.startDate.clear",
    updateTask,
    "startDate",
    "backlog",
  ],
  [
    "tasks:boardFilters.subjects.dueDate",
    "tasks:popover.dueDate.clear",
    updateDueDate,
    "dueDate",
    "backlog",
  ],
] as const)(
  "opens and clears a visible date property (%s)",
  async (label, clear, mutate, field, viewMode) => {
    renderCard(task, viewMode);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(await screen.findByRole("grid")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: clear }));
    await vi.waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          [field]: null,
        }),
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  },
);

it.each(["board", "list", "backlog"] as const)(
  "loads labels only on click in %s and keeps their multi-select editor open",
  async (viewMode) => {
    renderCard(task, viewMode);
    expect(loadTaskLabels).not.toHaveBeenCalled();
    const trigger = screen.getByRole("button", {
      name: "tasks:properties.labels",
    });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    const popup = await screen.findByRole("dialog");
    fireEvent.click(within(popup).getByRole("button", { name: "Other label" }));
    await vi.waitFor(() =>
      expect(attachLabel).toHaveBeenCalledWith({
        labelId: "other-label",
        taskId: task.id,
      }),
    );
    expect(
      screen.getByRole("button", { name: "tasks:properties.labels" }),
    ).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(
      within(popup).getByRole("button", { name: "Regression label" }),
    );
    await vi.waitFor(() =>
      expect(detachLabel).toHaveBeenCalledWith({ labelId: "task-label" }),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(dragStart).not.toHaveBeenCalled();
  },
);

it.each(["board", "list", "backlog"] as const)(
  "preserves read-only tasks in %s without property editor buttons or queries",
  (viewMode) => {
    canEdit = false;
    canAssign = false;
    renderCard(task, viewMode);
    expect(
      screen.queryByRole("button", { name: "High" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "tasks:boardFilters.subjects.assignee",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "tasks:properties.labels" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Regression label")).toBeVisible();
    expect(loadTaskLabels).not.toHaveBeenCalled();
  },
);

it.each(["board", "list", "backlog"] as const)(
  "shows plain properties on mobile in %s and opens task details when tapped",
  (viewMode) => {
    isMobile = true;
    renderCard(task, viewMode);
    for (const name of [
      "High",
      "tasks:boardFilters.subjects.assignee",
      "tasks:properties.labels",
      "tasks:properties.startDate",
      "tasks:boardFilters.subjects.dueDate",
    ]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByTitle("High")).toBeVisible();
    fireEvent.click(screen.getByText("Regression label"));
    expect(navigate).toHaveBeenCalledOnce();
    expect(loadTaskLabels).not.toHaveBeenCalled();
  },
);

it.each(["board", "list", "backlog"] as const)(
  "closes an inline editor in %s when narrowing the screen and does not reopen it when widening",
  async (viewMode) => {
    const view = renderCard(task, viewMode);
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(await screen.findByRole("dialog")).toBeVisible();

    isMobile = true;
    view.rerenderCard();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "High" }),
    ).not.toBeInTheDocument();

    isMobile = false;
    view.rerenderCard();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
  },
);

it.each([
  ["tasks:properties.startDate", updateTask, "startDate", "board"],
  ["tasks:boardFilters.subjects.dueDate", updateDueDate, "dueDate", "board"],
  ["tasks:properties.startDate", updateTask, "startDate", "list"],
  ["tasks:boardFilters.subjects.dueDate", updateDueDate, "dueDate", "list"],
  ["tasks:properties.startDate", updateTask, "startDate", "backlog"],
  ["tasks:boardFilters.subjects.dueDate", updateDueDate, "dueDate", "backlog"],
] as const)(
  "saves a selected %s and closes the calendar",
  async (label, mutate, field, viewMode) => {
    const today = new Date();
    renderCard(
      {
        ...task,
        startDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
        ).toISOString(),
        dueDate: new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0,
        ).toISOString(),
      },
      viewMode,
    );
    fireEvent.click(screen.getByRole("button", { name: label }));
    const grid = await screen.findByRole("grid");
    const day = within(grid)
      .getAllByRole("button")
      .find((button) => button.textContent === "15");
    if (!day) throw new Error("Calendar day is missing");
    fireEvent.click(day);
    await vi.waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          [field]: new Date(
            today.getFullYear(),
            today.getMonth(),
            15,
          ).toISOString(),
        }),
      ),
    );
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  },
);

it.each(["board", "list", "backlog"] as const)(
  "respects assignment permission separately from task editing in %s",
  (viewMode) => {
    canAssign = false;
    renderCard(task, viewMode);
    expect(
      screen.queryByRole("button", {
        name: "tasks:boardFilters.subjects.assignee",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "High" })).toBeVisible();
  },
);
