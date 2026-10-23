import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { GlobalBoardMeta } from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import type { ColumnChoice } from "./column-choice-dialog";
import { GlobalBoard } from "./index";

type Handler = (event: unknown) => void;

const mocks = vi.hoisted(() => ({
  move: vi.fn(),
  toastError: vi.fn(),
  lanes: {} as Record<string, unknown[]>,
  handlers: {} as Record<"start" | "over" | "end", Handler | undefined>,
  rendered: {} as Record<string, string[]>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("framer-motion", () => ({ useReducedMotion: () => true }));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/hooks/mutations/task/use-move-global-board-task", () => ({
  useMoveGlobalBoardTask: () => mocks.move,
}));
vi.mock("@/hooks/queries/task/use-global-board-tasks", () => ({
  default: (lane: string) => ({
    data: {
      pages: [
        {
          tasks: mocks.lanes[lane] ?? [],
          pagination: { total: (mocks.lanes[lane] ?? []).length },
        },
      ],
    },
  }),
}));
vi.mock("./global-board-lane", () => ({
  GlobalBoardLaneColumn: ({
    lane,
    tasks,
  }: {
    lane: string;
    tasks: { id: string }[];
  }) => {
    mocks.rendered[lane] = tasks.map((task) => task.id);
    return null;
  },
}));
vi.mock("./column-choice-dialog", () => ({
  ColumnChoiceDialog: ({ choice }: { choice: ColumnChoice | null }) =>
    choice ? (
      <div>
        {choice.columns.map((column) => (
          <button
            key={column.slug}
            type="button"
            onClick={() => choice.onChoose(column)}
          >
            choose-{column.slug}
          </button>
        ))}
      </div>
    ) : null,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragStart: Handler;
    onDragOver: Handler;
    onDragEnd: Handler;
  }) => {
    mocks.handlers = { start: onDragStart, over: onDragOver, end: onDragEnd };
    return <>{children}</>;
  },
  DragOverlay: () => null,
  MouseSensor: {},
  TouchSensor: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  defaultDropAnimationSideEffects: vi.fn(),
}));

const column = (
  slug: string,
  globalStatus: "to-do" | "in-progress" | "done" | null,
  position: number,
) => ({
  slug,
  name: slug,
  icon: null,
  isFinal: globalStatus === "done",
  position,
  globalStatus,
});

const meta: GlobalBoardMeta = {
  workspaces: [
    { id: "w1", name: "Agency", slug: "agency", canMoveTasks: true },
    { id: "w2", name: "Client", slug: "client", canMoveTasks: false },
  ],
  projects: [
    {
      id: "web",
      name: "Web",
      slug: "web",
      icon: null,
      workspaceId: "w1",
      columns: [
        column("to-do", "to-do", 0),
        column("in-progress", "in-progress", 1),
        column("in-review", "in-progress", 2),
        column("done", "done", 3),
      ],
    },
    {
      id: "ops",
      name: "Ops",
      slug: "ops",
      icon: null,
      workspaceId: "w1",
      columns: [column("open", "to-do", 0), column("closed", "done", 1)],
    },
    {
      id: "app",
      name: "App",
      slug: "app",
      icon: null,
      workspaceId: "w2",
      columns: [column("to-do", "to-do", 0), column("done", "done", 1)],
    },
  ],
  assignees: [],
  labels: [],
};

const task = (id: string, projectId: string, status: string) =>
  ({
    id,
    projectId,
    projectName: projectId,
    status,
    title: id,
    workspaceId: projectId === "app" ? "w2" : "w1",
  }) as GlobalBoardTask;

const fire = (name: "start" | "over" | "end", event: unknown) =>
  act(() => mocks.handlers[name]?.(event));
const start = (item: GlobalBoardTask, lane: string) =>
  fire("start", {
    active: { id: item.id, data: { current: { task: item, lane } } },
  });
const overCard = (id: string, lane: string) =>
  fire("over", { over: { id, data: { current: { lane } } } });
const endOver = (id: string, lane: string) =>
  fire("end", { over: { id, data: { current: { lane } } } });
const laneTask = (lane: string, index: number) =>
  mocks.lanes[lane]?.[index] as GlobalBoardTask;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rendered = {};
  mocks.lanes = {
    "to-do": [
      task("a", "web", "to-do"),
      task("x", "web", "to-do"),
      task("o", "ops", "open"),
    ],
    "in-progress": [
      task("p1", "web", "in-progress"),
      task("p2", "web", "in-review"),
    ],
    done: [task("d1", "web", "done")],
    unmapped: [],
  };
});
afterEach(cleanup);

describe("global board drag and drop", () => {
  it("reorders a card within its lane and sends the new order", () => {
    render(<GlobalBoard meta={meta} filters={{}} />);
    start(laneTask("to-do", 1), "to-do");
    endOver("o", "to-do");

    expect(mocks.move).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "to-do",
        to: "to-do",
        index: 2,
        visibleIds: ["a", "o", "x"],
        column: undefined,
      }),
    );
    // The dropped card holds its new place while the request runs.
    expect(mocks.rendered["to-do"]).toEqual(["a", "o", "x"]);
  });

  it("previews the card in another lane and drops it where it was shown", () => {
    render(<GlobalBoard meta={meta} filters={{}} />);
    const moving = laneTask("to-do", 2);
    start(moving, "to-do");
    overCard("d1", "done");
    expect(mocks.rendered["to-do"]).toEqual(["a", "x"]);
    expect(mocks.rendered.done).toEqual(["o", "d1"]);

    endOver("o", "done");
    expect(mocks.move).toHaveBeenCalledWith(
      expect.objectContaining({
        task: moving,
        from: "to-do",
        to: "done",
        index: 0,
        visibleIds: ["o", "d1"],
        column: meta.projects[1]?.columns[1],
      }),
    );
  });

  it("asks which column when the lane matches several, keeping the drop position", async () => {
    const view = render(<GlobalBoard meta={meta} filters={{}} />);
    start(laneTask("to-do", 1), "to-do");
    overCard("p2", "in-progress");
    endOver("x", "in-progress");
    expect(mocks.move).not.toHaveBeenCalled();

    // A real choice comes well after the drop's own click is swallowed.
    await new Promise((resolve) => setTimeout(resolve, 60));
    fireEvent.click(view.getByText("choose-in-review"));
    expect(mocks.move).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "in-progress",
        index: 1,
        visibleIds: ["p1", "x", "p2"],
        column: meta.projects[0]?.columns[2],
      }),
    );
  });

  it("refuses a lane the task's project has no column for", () => {
    render(<GlobalBoard meta={meta} filters={{}} />);
    start(laneTask("to-do", 2), "to-do");
    overCard("p1", "in-progress");
    endOver("o", "in-progress");
    expect(mocks.move).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("tasks:globalBoard.noMatchingColumn"),
    );
    expect(mocks.rendered["to-do"]).toEqual(["a", "x", "o"]);
  });

  it("lets viewers reorder their own lane but not drag into another", () => {
    mocks.lanes["to-do"] = [
      task("v1", "app", "to-do"),
      task("v2", "app", "to-do"),
    ];
    render(<GlobalBoard meta={meta} filters={{}} />);
    start(laneTask("to-do", 0), "to-do");
    overCard("d1", "done");
    expect(mocks.rendered.done).toEqual(["d1"]);
    endOver("v2", "to-do");
    expect(mocks.move).toHaveBeenCalledWith(
      expect.objectContaining({ to: "to-do", visibleIds: ["v2", "v1"] }),
    );
  });

  it("does nothing when dropped where it started or outside the board", () => {
    render(<GlobalBoard meta={meta} filters={{}} />);
    start(laneTask("to-do", 1), "to-do");
    endOver("x", "to-do");
    start(laneTask("to-do", 1), "to-do");
    fire("end", { over: null });
    expect(mocks.move).not.toHaveBeenCalled();
  });
});
