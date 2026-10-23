import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { MoveToBoardButton } from "./move-to-board-button";

const mocks = vi.hoisted(() => ({
  updateTaskStatus: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { column?: string }) =>
      options?.column ? `${key}:${options.column}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: mocks.updateTaskStatus }),
}));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

const planned = { id: "t1", status: "planned", title: "Plan me" } as Task;

function project(columns: { slug: string; name: string; isFinal: boolean }[]) {
  return {
    id: "p1",
    columns: columns.map((column) => ({
      ...column,
      id: column.slug,
      tasks: [],
    })),
    plannedTasks: [planned],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
}

const defaultColumns = [
  { slug: "to-do", name: "To Do", isFinal: false },
  { slug: "done", name: "Done", isFinal: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.getState().setProject(project(defaultColumns));
});
afterEach(cleanup);

describe("MoveToBoardButton", () => {
  it("moves a planned task to To Do in one click, without opening it", async () => {
    mocks.updateTaskStatus.mockResolvedValue({});
    // Stands in for the row, which opens the task on click.
    const openTask = vi.fn();
    document.addEventListener("click", openTask);
    render(<MoveToBoardButton task={planned} />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: "tasks:backlog.moveToColumn:To Do",
        }),
      );
    });

    document.removeEventListener("click", openTask);
    expect(openTask).not.toHaveBeenCalled();
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith({
      ...planned,
      status: "to-do",
    });
    const state = useProjectStore.getState().project;
    expect(state?.plannedTasks).toEqual([]);
    expect(state?.columns?.[0]?.tasks.map((task) => task.id)).toEqual(["t1"]);
    expect(mocks.toast.success).toHaveBeenCalled();
  });

  it("uses the first open column when the project has no To Do", () => {
    useProjectStore.getState().setProject(
      project([
        { slug: "ideas", name: "Ideas", isFinal: false },
        { slug: "shipped", name: "Shipped", isFinal: true },
      ]),
    );
    render(<MoveToBoardButton task={planned} />);
    expect(
      screen.getByRole("button", { name: "tasks:backlog.moveToColumn:Ideas" }),
    ).toBeInTheDocument();
  });

  it("puts the task back in the backlog when the move fails", async () => {
    mocks.updateTaskStatus.mockRejectedValue(new Error("nope"));
    render(<MoveToBoardButton task={planned} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(
      useProjectStore.getState().project?.plannedTasks?.map((task) => task.id),
    ).toEqual(["t1"]);
    expect(mocks.toast.error).toHaveBeenCalledWith(
      "tasks:backlog.moveToColumnError",
    );
  });

  it("only appears on planned tasks with somewhere to go", () => {
    const { rerender } = render(
      <MoveToBoardButton task={{ ...planned, status: "archived" }} />,
    );
    expect(screen.queryByRole("button")).toBeNull();

    useProjectStore
      .getState()
      .setProject(project([{ slug: "done", name: "Done", isFinal: true }]));
    rerender(<MoveToBoardButton task={planned} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
