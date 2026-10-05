import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { ReactNode } from "react";
import type { TaskReorder } from "@/fetchers/task/reorder-tasks";
import type { ProjectWithTasks } from "@/types/project";
import KanbanBoard from "./index";

const mocks = vi.hoisted(() => ({
  project: null as unknown,
  setProject: vi.fn(),
  reorder: vi.fn(),
  setQueryData: vi.fn(),
  updatePriority: vi.fn(),
  mutationIndex: 0,
  modifierKey: "Ctrl",
  invalidateQueries: vi.fn(),
  success: undefined as
    | ((
        result: unknown,
        variables: TaskReorder & { previousBoard: ProjectWithTasks },
      ) => void)
    | undefined,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => {
    // The board calls useQueryClient before its mutations on every render.
    mocks.mutationIndex = 0;
    return {
      setQueryData: mocks.setQueryData,
      invalidateQueries: mocks.invalidateQueries,
      getQueryData: () => mocks.project,
      getQueryState: () => undefined,
    };
  },
  useMutation: ({ onSuccess }: { onSuccess: typeof mocks.success }) => {
    if (mocks.mutationIndex++ === 0) {
      mocks.success = onSuccess;
      return { mutate: mocks.reorder, isPending: false };
    }
    return { mutate: mocks.updatePriority, isPending: false };
  },
}));
vi.mock("@kaneo/libs", () => ({ client: {} }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/store/project", () => ({
  default: () => ({ project: mocks.project, setProject: mocks.setProject }),
}));
vi.mock("@/store/background", () => ({
  useBackgroundStore: () => ({ setBackground: vi.fn() }),
}));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: vi.fn(),
  getModifierKeyText: () => mocks.modifierKey,
}));
vi.mock("@/hooks/use-project-background", () => ({
  useProjectBackground: () => null,
}));
vi.mock("../bulk-selection/bulk-toolbar", () => ({ default: () => null }));
vi.mock("./column", () => ({
  default: ({
    automaticSortLabel,
    column,
    isSortOverlaySuppressed,
    sortOverlayColumnId,
  }: {
    automaticSortLabel?: string;
    column: { id: string; tasks: { id: string }[] };
    isSortOverlaySuppressed: boolean;
    sortOverlayColumnId: string | null;
  }) => (
    <div
      data-testid={`column-${column.id}`}
      data-task-ids={column.tasks.map((task) => task.id).join(",")}
      data-automatic-sort-label={automaticSortLabel}
      data-sort-overlay={
        sortOverlayColumnId === column.id && !isSortOverlaySuppressed
          ? "visible"
          : "hidden"
      }
    />
  ),
}));
vi.mock("./task-card", () => ({ default: () => null }));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragStart: (event: unknown) => void;
    onDragOver: (event: unknown) => void;
    onDragEnd: (event: unknown) => void;
  }) => (
    <>
      {children}
      <button
        onClick={(event) =>
          onDragStart({
            active: { id: "a" },
            activatorEvent: event.nativeEvent,
          })
        }
      >
        start
      </button>
      <button
        onClick={() =>
          onDragOver({
            active: {
              id: "a",
              rect: { current: { translated: { top: 20, height: 80 } } },
            },
            over: { id: "c", rect: { top: 100, height: 80 } },
          })
        }
      >
        over
      </button>
      <button
        onClick={() =>
          onDragOver({
            active: {
              id: "a",
              rect: { current: { translated: { top: 110, height: 80 } } },
            },
            over: { id: "c", rect: { top: 100, height: 80 } },
          })
        }
      >
        over-center
      </button>
      <button
        onClick={() =>
          onDragOver({
            active: {
              id: "a",
              rect: { current: { translated: { top: 20 } } },
            },
            over: { id: "a", rect: { top: 20, height: 80 } },
          })
        }
      >
        over-active
      </button>
      <button
        onClick={() => onDragEnd({ active: { id: "a" }, over: { id: "b" } })}
      >
        drop
      </button>
      <button
        onClick={() => onDragEnd({ active: { id: "a" }, over: { id: "a" } })}
      >
        drop-over
      </button>
      <button
        onClick={() => onDragEnd({ active: { id: "a" }, over: { id: "c" } })}
      >
        drop-c
      </button>
    </>
  ),
  DragOverlay: () => null,
  MouseSensor: {},
  TouchSensor: {},
  KeyboardSensor: {},
  closestCorners: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  defaultDropAnimationSideEffects: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modifierKey = "Ctrl";
});
afterEach(cleanup);
describe("filtered board dragging", () => {
  it("moves visible tasks in canonical state and sends one ordering mutation", () => {
    const columns = [
      {
        id: "todo",
        slug: "todo",
        tasks: [
          { id: "a", status: "todo", position: 0 },
          { id: "hidden", status: "todo", position: 1 },
          { id: "b", status: "todo", position: 2 },
        ],
      },
    ];
    const canonical = {
      id: "p",
      columns,
      plannedTasks: [],
      archivedTasks: [],
    } as unknown as ProjectWithTasks;
    mocks.project = canonical;
    const filtered = {
      ...canonical,
      columns: [
        {
          ...columns[0],
          tasks: columns[0].tasks.filter((task) => task.id !== "hidden"),
        },
      ],
    } as unknown as ProjectWithTasks;
    const view = render(<KanbanBoard project={filtered} />);
    fireEvent.click(view.getByText("drop"));
    expect(
      mocks.setProject.mock.calls[0][0].columns[0].tasks.map(
        (task: { id: string }) => task.id,
      ),
    ).toEqual(["hidden", "b", "a"]);
    expect(mocks.reorder).toHaveBeenCalledOnce();
    mocks.success?.(null, mocks.reorder.mock.calls[0]?.[0]);
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["assigned-tasks"],
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["workspace-activity"],
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["projects"],
    });
    view.unmount();
  });
});

it("rejects an in-flight Kanban drop after a failed refresh disables dragging", () => {
  const canonical = {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [
          { id: "a", status: "todo", position: 0 },
          { id: "b", status: "todo", position: 1 },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  mocks.project = canonical;
  const view = render(<KanbanBoard project={canonical} />);
  fireEvent.click(view.getByText("start"));
  view.rerender(<KanbanBoard project={canonical} disableDragDrop />);
  fireEvent.click(view.getByText("drop"));
  expect(mocks.reorder).not.toHaveBeenCalled();
  expect(mocks.setProject).not.toHaveBeenCalled();
  expect(mocks.setQueryData).not.toHaveBeenCalled();
});

it("refreshes personal work after a cross-column status change", () => {
  const project = {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [{ id: "a", status: "todo", position: 0 }],
      },
      {
        id: "done",
        slug: "done",
        tasks: [{ id: "b", status: "done", position: 0 }],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  mocks.project = project;
  const view = render(<KanbanBoard project={project} />);
  fireEvent.click(view.getByText("drop"));
  expect(mocks.reorder).toHaveBeenCalledOnce();
  mocks.success?.(null, mocks.reorder.mock.calls[0]?.[0]);
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["assigned-tasks"],
  });
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["workspace-activity"],
  });
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["projects"],
  });
});

it("places a cross-column drop at the bottom without Command", () => {
  const canonical = {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [{ id: "a", status: "todo", position: 0, priority: "low" }],
      },
      {
        id: "doing",
        slug: "doing",
        tasks: [
          { id: "c", status: "doing", position: 0, priority: "high" },
          { id: "d", status: "doing", position: 1, priority: "medium" },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  mocks.project = canonical;
  const view = render(<KanbanBoard project={canonical} />);

  fireEvent.click(view.getByText("start"));
  fireEvent.click(view.getByText("drop-c"));

  expect(
    mocks.setProject.mock.calls[0][0].columns[1].tasks.map(
      (task: { id: string }) => task.id,
    ),
  ).toEqual(["c", "d", "a"]);
  expect(mocks.setProject.mock.calls[0][0].columns[1].tasks[2].priority).toBe(
    "low",
  );
});

it("cancels a stale cross-column drop after returning to the active card", () => {
  const canonical = {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [{ id: "a", status: "todo", position: 0, priority: "low" }],
      },
      {
        id: "doing",
        slug: "doing",
        tasks: [{ id: "c", status: "doing", position: 0, priority: "high" }],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  mocks.project = canonical;
  const view = render(<KanbanBoard project={canonical} />);

  fireEvent.click(view.getByText("start"));
  fireEvent.click(view.getByText("over"));
  fireEvent.click(view.getByText("over-active"));
  fireEvent.click(view.getByText("drop-over"));

  expect(mocks.setProject).not.toHaveBeenCalled();
  expect(mocks.reorder).not.toHaveBeenCalled();
});

it("keeps modifier-assisted drops append-only on number-sorted boards", () => {
  const canonical = {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [{ id: "a", status: "todo", position: 0, priority: "low" }],
      },
      {
        id: "doing",
        slug: "doing",
        tasks: [
          { id: "c", status: "doing", position: 0, priority: "high" },
          { id: "d", status: "doing", position: 1, priority: "medium" },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  mocks.project = canonical;
  const view = render(
    <KanbanBoard project={canonical} sortedByNumber={true} />,
  );

  fireEvent.click(view.getByText("start"), { ctrlKey: true });
  fireEvent.click(view.getByText("over"));
  fireEvent.keyDown(window, { key: "Control", ctrlKey: true });
  fireEvent.click(view.getByText("over-center"));

  expect(view.getByTestId("column-doing")).toHaveAttribute(
    "data-sort-overlay",
    "visible",
  );
  expect(view.getByTestId("column-doing")).toHaveAttribute(
    "data-automatic-sort-label",
    "tasks:sort.fields.number",
  );
  expect(view.getByTestId("column-doing")).toHaveAttribute(
    "data-task-ids",
    "c,d",
  );

  fireEvent.click(view.getByText("drop-c"));

  expect(
    mocks.setProject.mock.calls[0][0].columns[1].tasks.map(
      (task: { id: string }) => task.id,
    ),
  ).toEqual(["c", "d", "a"]);
  expect(mocks.reorder).toHaveBeenCalledOnce();
});

it("keeps modifier-assisted drops append-only on priority-sorted boards", () => {
  const canonical = {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [{ id: "a", status: "todo", position: 0, priority: "low" }],
      },
      {
        id: "doing",
        slug: "doing",
        tasks: [
          { id: "c", status: "doing", position: 0, priority: "high" },
          { id: "d", status: "doing", position: 1, priority: "medium" },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  mocks.project = canonical;
  const view = render(
    <KanbanBoard project={canonical} sortedByPriority={true} />,
  );

  fireEvent.click(view.getByText("start"), { ctrlKey: true });
  fireEvent.click(view.getByText("over"));
  fireEvent.keyDown(window, { key: "Control", ctrlKey: true });
  fireEvent.click(view.getByText("over-center"));

  expect(view.getByTestId("column-doing")).toHaveAttribute(
    "data-sort-overlay",
    "visible",
  );
  expect(view.getByTestId("column-doing")).toHaveAttribute(
    "data-automatic-sort-label",
    "tasks:sort.fields.priority",
  );
  expect(view.getByTestId("column-doing")).toHaveAttribute(
    "data-task-ids",
    "c,d",
  );

  fireEvent.click(view.getByText("drop-c"));

  expect(
    mocks.setProject.mock.calls[0][0].columns[1].tasks.map(
      (task: { id: string }) => task.id,
    ),
  ).toEqual(["c", "d", "a"]);
  expect(mocks.setProject.mock.calls[0][0].columns[1].tasks[2].priority).toBe(
    "low",
  );
  expect(mocks.reorder).toHaveBeenCalledOnce();
});

describe.each([
  ["⌘", "Meta", "metaKey"],
  ["Ctrl", "Control", "ctrlKey"],
  ["Ctrl", "Meta", "metaKey"],
])("sorting with %s and %s", (label, key, modifier) => {
  it.each(["held", "released", "blurred", "held-at-start"])(
    "uses the matching drop behavior when modifier is %s",
    (commandState) => {
      mocks.modifierKey = label;
      const canonical = {
        id: "p",
        columns: [
          {
            id: "todo",
            slug: "todo",
            tasks: [{ id: "a", status: "todo", position: 0, priority: "low" }],
          },
          {
            id: "doing",
            slug: "doing",
            tasks: [
              { id: "c", status: "doing", position: 0, priority: "high" },
            ],
          },
        ],
        plannedTasks: [],
        archivedTasks: [],
      } as unknown as ProjectWithTasks;
      mocks.project = canonical;
      const view = render(<KanbanBoard project={canonical} />);

      fireEvent.click(view.getByText("start"), {
        [modifier]: commandState === "held-at-start",
      });
      fireEvent.click(view.getByText("over"));
      expect(view.getByTestId("column-doing")).toHaveAttribute(
        "data-sort-overlay",
        commandState === "held-at-start" ? "hidden" : "visible",
      );
      expect(view.getByTestId("column-doing")).not.toHaveAttribute(
        "data-automatic-sort-label",
      );

      if (commandState !== "held-at-start")
        fireEvent.keyDown(window, { key, [modifier]: true });
      fireEvent.keyUp(window, { key: "a", [modifier]: true });
      expect(view.getByTestId("column-doing")).toHaveAttribute(
        "data-sort-overlay",
        "hidden",
      );
      expect(view.getByTestId("column-doing")).toHaveAttribute(
        "data-task-ids",
        "a,c",
      );

      if (commandState === "held" || commandState === "held-at-start") {
        fireEvent.click(view.getByText("over-center"));
        expect(view.getByTestId("column-doing")).toHaveAttribute(
          "data-task-ids",
          "c,a",
        );
        fireEvent.click(view.getByText("over-active"));
        fireEvent.click(view.getByText("drop-over"));
        expect(
          mocks.setProject.mock.calls[0][0].columns[1].tasks.map(
            (task: { id: string }) => task.id,
          ),
        ).toEqual(["c", "a"]);
        return;
      }

      if (commandState === "released") {
        fireEvent.keyUp(window, { key, [modifier]: false });
      } else {
        fireEvent.blur(window);
      }
      expect(view.getByTestId("column-doing")).toHaveAttribute(
        "data-sort-overlay",
        "visible",
      );
      expect(view.getByTestId("column-doing")).toHaveAttribute(
        "data-task-ids",
        "c",
      );

      fireEvent.click(view.getByText("over-active"));
      expect(view.getByTestId("column-doing")).toHaveAttribute(
        "data-task-ids",
        "c",
      );

      fireEvent.click(view.getByText("drop-over"));
      expect(mocks.setProject).not.toHaveBeenCalled();
      expect(mocks.reorder).not.toHaveBeenCalled();
    },
  );
});
