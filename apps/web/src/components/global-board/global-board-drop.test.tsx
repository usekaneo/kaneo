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

const mocks = vi.hoisted(() => ({
  move: vi.fn(),
  toastError: vi.fn(),
  dragEnd: undefined as ((event: unknown) => void) | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/hooks/mutations/task/use-move-global-board-task", () => ({
  useMoveGlobalBoardTask: () => ({ mutate: mocks.move }),
}));
vi.mock("./global-board-lane", () => ({
  GlobalBoardLaneColumn: () => null,
}));
vi.mock("./global-board-card", () => ({ default: () => null }));
vi.mock("./column-choice-dialog", () => ({
  ColumnChoiceDialog: ({ choice }: { choice: ColumnChoice | null }) =>
    choice ? (
      <div data-testid="choice">
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
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
  }) => {
    mocks.dragEnd = onDragEnd;
    return <>{children}</>;
  },
  DragOverlay: () => null,
  MouseSensor: {},
  TouchSensor: {},
  pointerWithin: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
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
  ],
  assignees: [],
  labels: [],
};

const task = (projectId: string, status: string) =>
  ({
    id: `${projectId}-1`,
    projectId,
    projectName: projectId === "web" ? "Web" : "Ops",
    status,
    title: "Ship it",
    workspaceId: "w1",
  }) as GlobalBoardTask;

function drop(dragged: GlobalBoardTask, from: string, to: string) {
  act(() =>
    mocks.dragEnd?.({
      active: { data: { current: { task: dragged, lane: from } } },
      over: { data: { current: { lane: to } } },
    }),
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("global board drops", () => {
  it("moves a task into its project's only column for the lane", () => {
    render(<GlobalBoard meta={meta} filters={{}} />);
    const dragged = task("web", "to-do");
    drop(dragged, "to-do", "done");
    expect(mocks.move).toHaveBeenCalledWith({
      task: dragged,
      from: "to-do",
      to: "done",
      column: meta.projects[0]?.columns[3],
    });
  });

  it("asks which column when the lane matches several, and moves only after a choice", async () => {
    const view = render(<GlobalBoard meta={meta} filters={{}} />);
    const dragged = task("web", "to-do");
    drop(dragged, "to-do", "in-progress");
    expect(mocks.move).not.toHaveBeenCalled();

    // A real choice comes well after the drop's own click is swallowed.
    await new Promise((resolve) => setTimeout(resolve, 60));
    fireEvent.click(view.getByText("choose-in-review"));
    expect(mocks.move).toHaveBeenCalledWith({
      task: dragged,
      from: "to-do",
      to: "in-progress",
      column: meta.projects[0]?.columns[2],
    });
  });

  it("refuses a lane the task's project has no column for", () => {
    render(<GlobalBoard meta={meta} filters={{}} />);
    drop(task("ops", "open"), "to-do", "in-progress");
    expect(mocks.move).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("tasks:globalBoard.noMatchingColumn"),
    );
  });

  it("ignores drops back onto the same lane or outside any lane", () => {
    render(<GlobalBoard meta={meta} filters={{}} />);
    drop(task("web", "in-review"), "in-progress", "in-progress");
    act(() =>
      mocks.dragEnd?.({
        active: {
          data: { current: { task: task("web", "to-do"), lane: "to-do" } },
        },
        over: null,
      }),
    );
    expect(mocks.move).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
