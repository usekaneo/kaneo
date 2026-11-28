import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { writeExpandedRows } from "@/lib/expanded-rows-storage";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import useBulkSelectionStore from "@/store/bulk-selection";
import type { ProjectWithTasks } from "@/types/project";
import useProjectStore from "@/store/project";
import ListView from ".";

const mocks = vi.hoisted(() => ({ reorder: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ preloadRoute: () => Promise.resolve() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/prefetch-task", () => ({
  prefetchTask: vi.fn(),
}));
vi.mock("@/fetchers/task/reorder-tasks", () => ({
  default: mocks.reorder,
}));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({
    data: [
      {
        sourceTaskId: "parent",
        targetTaskId: "child",
        relationType: "subtask",
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("./task-row", () => ({
  default: ({
    task,
    rowId,
  }: {
    task: { id: string; status: string; position: number };
    rowId: string;
  }) => (
    <button
      type="button"
      data-task-id={task.id}
      data-task-status={task.status}
      data-task-position={task.position}
      data-task-row-id={rowId}
      onFocus={() =>
        useBulkSelectionStore.getState().setFocusedTask(task.id, rowId)
      }
    />
  ),
}));
vi.mock("../bulk-selection/bulk-toolbar", () => ({ default: () => null }));
vi.mock("../shared/modals/create-task-modal", () => ({ default: () => null }));
vi.mock("../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));

function mount({ hideSubtasks = false }: { hideSubtasks?: boolean } = {}) {
  writeExpandedRows("keyboard-project", { parent: true });
  const originalProject = {
    id: "keyboard-project",
    workspaceId: "workspace",
    columns: [
      {
        id: "todo",
        slug: "todo",
        name: "To do",
        tasks: [
          { id: "parent", status: "todo", position: 0 },
          { id: "sibling", status: "todo", position: 1 },
        ],
      },
      {
        id: "doing",
        slug: "doing",
        name: "Doing",
        tasks: [
          {
            id: "child",
            status: "doing",
            position: 0,
            title: "Hidden child",
            description: "Keep the hidden description",
            priority: "high",
            userId: "assigned-user",
          },
          { id: "last", status: "doing", position: 1 },
        ],
      },
    ],
  } as ProjectWithTasks;
  function ListFixture() {
    const project =
      useProjectStore((state) => state.project) ?? originalProject;
    const shown = hideSubtasks
      ? {
          ...project,
          columns: project.columns.map((column) => ({
            ...column,
            tasks: column.tasks.filter((task) => task.id !== "child"),
          })),
        }
      : project;
    return (
      <ListView
        project={shown}
        subtaskSource={project}
        completeProject={project}
      />
    );
  }

  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ShortcutTestWrapper>
        <ListFixture />
      </ShortcutTestWrapper>
    </QueryClientProvider>,
  );
  return { originalProject, queryClient };
}
const press = (key: string, code: string, altKey = false) =>
  fireEvent.keyDown(document.body, { key, code, altKey });

afterEach(() => {
  cleanup();
  shortcutRegistry.reset();
  localStorage.clear();
  useBulkSelectionStore.getState().clearFocus();
  useBulkSelectionStore.getState().clearSelection();
  useProjectStore.getState().setProject(undefined);
  vi.clearAllMocks();
});

it("visits each rendered occurrence in order without looping", () => {
  mount();
  const visited: (string | null)[] = [];
  for (let index = 0; index < 6; index++) {
    press("j", "KeyJ");
    visited.push(useBulkSelectionStore.getState().focusedTaskRowId);
  }
  expect(visited).toEqual([
    "parent",
    "parent/child",
    "sibling",
    "child",
    "last",
    "last",
  ]);
});

it("continues from the lower occurrence when a child is focused directly", () => {
  mount();
  const row = document.querySelector<HTMLElement>(
    '[data-task-row-id="child"]',
  )!;
  act(() => row.focus());
  press("j", "KeyJ");
  expect(useBulkSelectionStore.getState().focusedTaskRowId).toBe("last");
  act(() => row.focus());
  press("k", "KeyK");
  expect(useBulkSelectionStore.getState().focusedTaskRowId).toBe("sibling");
});

it("navigates to a child's own row when its parent group is collapsed", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: /^To do/ }));
  press("j", "KeyJ");
  expect(useBulkSelectionStore.getState().focusedTaskId).toBe("child");
  press("j", "KeyJ");
  expect(useBulkSelectionStore.getState().focusedTaskId).toBe("last");
  press("t", "KeyT");
  expect(screen.getByRole("button", { name: /^Doing/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(screen.getByRole("button", { name: /^To do/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("reorders a repeated child within its own status group and retains its occurrence", async () => {
  mount();
  const row = document.querySelector<HTMLElement>(
    '[data-task-row-id="child"]',
  )!;
  act(() => row.focus());
  press("ArrowDown", "ArrowDown", true);
  await waitFor(() =>
    expect(mocks.reorder).toHaveBeenCalledWith({
      projectId: "keyboard-project",
      tasks: [{ id: "child", position: 2 }],
      expectedTasks: [
        { id: "child", position: 0, status: "doing" },
        { id: "last", position: 1, status: "doing" },
      ],
    }),
  );
  await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  expect(row).toHaveFocus();
});

it("nests a hidden subtask under its parent without giving it its own row", () => {
  mount({ hideSubtasks: true });
  const rows = [...document.querySelectorAll("[data-task-row-id]")].map((row) =>
    row.getAttribute("data-task-row-id"),
  );
  expect(rows).toEqual(["parent", "parent/child", "sibling", "last"]);
});

it("moves a nested-only subtask optimistically and sends only reorder fields", async () => {
  const { originalProject, queryClient } = mount({ hideSubtasks: true });
  press("j", "KeyJ");
  press("j", "KeyJ");
  press("ArrowDown", "ArrowDown", true);

  expect(
    document.querySelector('[data-task-row-id="parent/child"]'),
  ).toHaveAttribute("data-task-position", "2");
  expect(document.querySelector('[data-task-row-id="child"]')).toBeNull();
  const optimistic = useProjectStore.getState().project;
  expect(queryClient.getQueryData(["tasks", originalProject.id])).toEqual(
    optimistic,
  );
  expect(optimistic?.columns[1].tasks).toEqual([
    originalProject.columns[1].tasks[1],
    { ...originalProject.columns[1].tasks[0], position: 2 },
  ]);
  await waitFor(() =>
    expect(mocks.reorder).toHaveBeenCalledWith({
      projectId: "keyboard-project",
      tasks: [{ id: "child", position: 2 }],
      expectedTasks: [
        { id: "child", position: 0, status: "doing" },
        { id: "last", position: 1, status: "doing" },
      ],
    }),
  );
});

it("keeps hidden subtasks in the optimistic project after moving a visible row", async () => {
  const { originalProject } = mount({ hideSubtasks: true });
  press("j", "KeyJ");
  press("ArrowDown", "ArrowDown", true);
  expect(useProjectStore.getState().project?.columns[1]).toBe(
    originalProject.columns[1],
  );
  expect(
    document.querySelector('[data-task-row-id="parent/child"]'),
  ).toBeVisible();
  await waitFor(() => expect(mocks.reorder).toHaveBeenCalledTimes(1));
});
