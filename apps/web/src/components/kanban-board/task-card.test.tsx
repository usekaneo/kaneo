import { DndContext, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { CardField } from "@/components/custom-fields/card-fields";
import type Task from "@/types/task";
import TaskCard from "./task-card";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@/store/project", () => ({
  default: () => ({
    project: {
      id: "project",
      slug: "PROJ",
      columns: [
        { id: "shared", slug: "shared", isFinal: true },
        { id: "shared", slug: "shared", isFinal: false },
      ],
    },
  }),
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({
    showLabels: true,
    showPriority: true,
    showDueDates: true,
    showTaskNumbers: true,
    showAssignees: true,
  }),
}));
vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({}),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({ useGetActiveWorkspaceUsers: () => ({}) }),
);
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
const cardFields = vi.hoisted((): CardField[] => []);
vi.mock("@/components/custom-fields/use-task-card-fields", () => ({
  useTaskCardFields: () => cardFields,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  // Only the priority picker is editable, so it's the one chip under test.
  useWorkspacePermission: () =>
    new Proxy({}, { get: (_, key) => () => key === "canUpdateTasks" }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status-priority", () => ({
  useUpdateTaskPriority: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("./task-card-context-menu/task-card-context-menu-content", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  onDragStart.mockClear();
  cardFields.length = 0;
});

const queryClient = new QueryClient();
const onDragStart = vi.fn();

function Board({ children }: { children: ReactNode }) {
  // Same activation constraint as the board.
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 10 },
    }),
  );
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart}>
      <SortableContext items={["task"]}>{children}</SortableContext>
    </DndContext>
  );
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <Board>{children}</Board>
  </QueryClientProvider>
);

const touchAt = { touches: [{ clientX: 0, clientY: 0 }] };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const holdPastDelay = () => wait(300);

const task: Task = {
  id: "task",
  title: "Open work",
  status: "shared",
  projectId: "project",
  number: 1,
  description: null,
  priority: "high",
  startDate: null,
  dueDate: "2030-01-01T00:00:00Z",
  position: 1,
  createdAt: "2026-10-01T00:00:00Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  labels: [{ id: "label", name: "Regression label", color: "red" }],
};

it("starts a drag when the card body is held", async () => {
  render(<TaskCard task={task} isFinalColumn={false} />, { wrapper });
  const title = screen.getByText("Open work");
  fireEvent.touchStart(title, touchAt);
  await holdPastDelay();
  fireEvent.touchEnd(title);
  expect(onDragStart).toHaveBeenCalledOnce();
  // dnd-kit swallows document clicks for 50ms after a drag ends.
  await wait(60);
});

it("opens a chip's picker on tap without starting a drag", async () => {
  render(<TaskCard task={task} isFinalColumn={false} />, { wrapper });
  const chip = screen.getByTitle(/^tasks:priority.label/);
  fireEvent.touchStart(chip, touchAt);
  fireEvent.touchEnd(chip);
  fireEvent.click(chip);
  expect(
    await screen.findByPlaceholderText("tasks:bulk.priorityPlaceholder"),
  ).toBeVisible();
  await holdPastDelay();
  expect(onDragStart).not.toHaveBeenCalled();
});

it("doesn't start a drag when a chip is held", async () => {
  render(<TaskCard task={task} isFinalColumn={false} />, { wrapper });
  const chip = screen.getByTitle(/^tasks:priority.label/);
  fireEvent.touchStart(chip, touchAt);
  await holdPastDelay();
  fireEvent.touchEnd(chip);
  expect(onDragStart).not.toHaveBeenCalled();
});

it("doesn't start a drag when the hidden custom fields button is held", async () => {
  cardFields.push(
    ...["One", "Two", "Three"].map((name) => ({
      fieldId: name,
      name,
      type: "text" as const,
      value: name,
    })),
  );
  render(<TaskCard task={task} isFinalColumn={false} />, { wrapper });
  const more = screen.getByText("+1");
  fireEvent.touchStart(more, touchAt);
  await holdPastDelay();
  fireEvent.touchEnd(more);
  expect(onDragStart).not.toHaveBeenCalled();
});

it("doesn't start a drag when the portaled picker is held", async () => {
  render(<TaskCard task={task} isFinalColumn={false} />, { wrapper });
  fireEvent.click(screen.getByTitle(/^tasks:priority.label/));
  const search = await screen.findByPlaceholderText(
    "tasks:bulk.priorityPlaceholder",
  );
  fireEvent.touchStart(search, touchAt);
  await holdPastDelay();
  fireEvent.touchEnd(search);
  expect(onDragStart).not.toHaveBeenCalled();
});

it("keeps details in the rendered open column despite a final column sharing its slug", () => {
  const view = render(<TaskCard task={task} isFinalColumn={false} />, {
    wrapper,
  });
  expect(screen.getByText("Regression label")).toBeVisible();
  view.rerender(<TaskCard task={task} isFinalColumn />);
  expect(screen.queryByText("Regression label")).not.toBeInTheDocument();
  expect(screen.getByText("Open work")).toBeVisible();
});
