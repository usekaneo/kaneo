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
  invalidateQueries: vi.fn(),
  success: undefined as
    | ((
        result: unknown,
        variables: TaskReorder & { previousBoard: ProjectWithTasks },
      ) => void)
    | undefined,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: mocks.setQueryData,
    invalidateQueries: mocks.invalidateQueries,
    getQueryData: () => mocks.project,
    getQueryState: () => undefined,
  }),
  useMutation: ({ onSuccess }: { onSuccess: typeof mocks.success }) => {
    mocks.success = onSuccess;
    return { mutate: mocks.reorder, isPending: false };
  },
}));
vi.mock("@kaneo/libs", () => ({ client: {} }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { sort?: string }) =>
      options?.sort ? `${key}:${options.sort}` : key,
  }),
}));
vi.mock("@/store/project", () => ({
  default: () => ({ project: mocks.project, setProject: mocks.setProject }),
}));
vi.mock("@/store/background", () => ({
  useBackgroundStore: () => ({ setBackground: vi.fn() }),
}));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: vi.fn(),
}));
vi.mock("@/hooks/use-project-background", () => ({
  useProjectBackground: () => null,
}));
vi.mock("../bulk-selection/bulk-toolbar", () => ({ default: () => null }));
vi.mock("./column", () => ({
  default: ({
    column,
    sortHint,
  }: {
    column: { id: string; tasks: { id: string }[] };
    sortHint?: string;
  }) => (
    <div
      data-testid={`column-${column.id}`}
      data-task-ids={column.tasks.map((task) => task.id).join(",")}
      data-sort-hint={sortHint}
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
    onDragCancel,
  }: {
    children: ReactNode;
    onDragStart: (event: unknown) => void;
    onDragOver: (event: unknown) => void;
    onDragEnd: (event: unknown) => void;
    onDragCancel: () => void;
  }) => {
    const hover = (overId: string) => () =>
      onDragOver({ active: { id: "a" }, over: { id: overId } });
    const drop = (overId: string) => () =>
      onDragEnd({ active: { id: "a" }, over: { id: overId } });
    return (
      <>
        {children}
        <button onClick={() => onDragStart({ active: { id: "a" } })}>
          start
        </button>
        <button onClick={hover("c")}>over-c</button>
        <button onClick={hover("todo")}>over-todo</button>
        <button onClick={() => onDragOver({ active: { id: "a" }, over: null })}>
          over-none
        </button>
        <button onClick={drop("b")}>drop</button>
        <button onClick={drop("a")}>drop-on-card</button>
        <button onClick={drop("c")}>drop-c</button>
        <button onClick={() => onDragEnd({ active: { id: "a" }, over: null })}>
          drop-gap
        </button>
        <button onClick={() => onDragCancel()}>cancel</button>
      </>
    );
  },
  DragOverlay: () => null,
  MouseSensor: {},
  TouchSensor: {},
  KeyboardSensor: {},
  closestCorners: {},
  pointerWithin: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  defaultDropAnimationSideEffects: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
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

function crossColumnBoard() {
  return {
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
}

function shownIds(view: ReturnType<typeof render>, columnId: string) {
  return view.getByTestId(`column-${columnId}`).getAttribute("data-task-ids");
}

function savedIds(columnIndex: number) {
  return mocks.setProject.mock.calls[0][0].columns[columnIndex].tasks.map(
    (task: { id: string }) => task.id,
  );
}

describe("cross-column dragging", () => {
  it("previews the card in the hovered card's slot and drops it there", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));
    expect(shownIds(view, "todo")).toBe("");
    expect(shownIds(view, "doing")).toBe("a,c,d");

    fireEvent.click(view.getByText("drop-on-card"));
    expect(savedIds(1)).toEqual(["a", "c", "d"]);
    expect(mocks.setProject.mock.calls[0][0].columns[1].tasks[0].priority).toBe(
      "low",
    );
    expect(mocks.reorder).toHaveBeenCalledOnce();
    expect(mocks.reorder.mock.calls[0][0].tasks).toContainEqual({
      id: "a",
      position: 0,
      status: "doing",
    });
    expect(shownIds(view, "doing")).toBe("c,d");
  });

  it("applies a final sortable hover inside the destination column", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));
    fireEvent.click(view.getByText("drop-c"));
    expect(savedIds(1)).toEqual(["c", "a", "d"]);
  });

  it("leaves the board unchanged when the card returns to its column", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));
    fireEvent.click(view.getByText("over-todo"));
    expect(shownIds(view, "todo")).toBe("a");
    expect(shownIds(view, "doing")).toBe("c,d");

    fireEvent.click(view.getByText("drop-on-card"));
    expect(mocks.setProject).not.toHaveBeenCalled();
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("restores the board when the drag is cancelled", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));
    fireEvent.click(view.getByText("cancel"));
    expect(shownIds(view, "todo")).toBe("a");
    expect(shownIds(view, "doing")).toBe("c,d");
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("cancels a previewed move released outside every column", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));
    fireEvent.click(view.getByText("over-none"));
    expect(shownIds(view, "todo")).toBe("a");
    expect(shownIds(view, "doing")).toBe("c,d");

    fireEvent.click(view.getByText("drop-gap"));
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("ignores a release outside every column without a preview", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("drop-gap"));
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("drops the preview once dragging is disabled mid-drag", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));
    expect(shownIds(view, "doing")).toBe("a,c,d");

    view.rerender(<KanbanBoard project={project} disableDragDrop />);
    fireEvent.click(view.getByText("over-c"));
    expect(shownIds(view, "todo")).toBe("a");
    expect(shownIds(view, "doing")).toBe("c,d");

    fireEvent.click(view.getByText("drop-gap"));
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("keeps board updates that arrive during a drag", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(<KanbanBoard project={project} />);

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));

    const updated = crossColumnBoard();
    updated.columns[1].tasks.push({
      id: "e",
      status: "doing",
      position: 2,
    } as (typeof updated.columns)[number]["tasks"][number]);
    mocks.project = updated;
    view.rerender(<KanbanBoard project={updated} />);
    expect(shownIds(view, "doing")).toBe("a,c,d,e");

    fireEvent.click(view.getByText("drop-on-card"));
    expect(savedIds(1)).toEqual(["a", "c", "d", "e"]);
  });
});

describe.each([
  ["sortedByNumber", "tasks:sort.fields.number"],
  ["sortedByPriority", "tasks:sort.fields.priority"],
])("%s boards", (sortProp, sortLabel) => {
  it("hints at the sort and appends the dropped card", () => {
    const project = crossColumnBoard();
    mocks.project = project;
    const view = render(
      <KanbanBoard project={project} {...{ [sortProp]: true }} />,
    );

    fireEvent.click(view.getByText("start"));
    fireEvent.click(view.getByText("over-c"));
    expect(shownIds(view, "doing")).toBe("c,d");
    expect(view.getByTestId("column-doing")).toHaveAttribute(
      "data-sort-hint",
      `tasks:kanban.automaticallySortedHint:${sortLabel}`,
    );
    expect(view.getByTestId("column-todo")).not.toHaveAttribute(
      "data-sort-hint",
    );

    fireEvent.click(view.getByText("over-todo"));
    expect(view.getByTestId("column-todo")).toHaveAttribute(
      "data-sort-hint",
      `tasks:kanban.automaticallySortedHint:${sortLabel}`,
    );
    expect(view.getByTestId("column-doing")).not.toHaveAttribute(
      "data-sort-hint",
    );

    fireEvent.click(view.getByText("drop-c"));
    expect(savedIds(1)).toEqual(["c", "d", "a"]);
    expect(mocks.reorder).toHaveBeenCalledOnce();
    expect(view.getByTestId("column-doing")).not.toHaveAttribute(
      "data-sort-hint",
    );
  });
});
