import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import KanbanBoard from "./index";

const mocks = vi.hoisted(() => ({
  project: null as unknown,
  setProject: vi.fn(),
  reorder: vi.fn(),
  setQueryData: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: mocks.setQueryData,
    getQueryData: () => mocks.project,
    getQueryState: () => undefined,
  }),
  useMutation: () => ({ mutate: mocks.reorder, isPending: false }),
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
vi.mock("@/store/bulk-selection", () => ({
  default: () => ({ setAvailableTasks: vi.fn(), clearFocus: vi.fn() }),
}));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: vi.fn(),
}));
vi.mock("@/hooks/use-project-background", () => ({
  useProjectBackground: () => null,
}));
vi.mock("../bulk-selection/bulk-toolbar", () => ({ default: () => null }));
vi.mock("./column", () => ({ default: () => null }));
vi.mock("./task-card", () => ({ default: () => null }));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ onDragEnd }: { onDragEnd: (event: unknown) => void }) => (
    <button
      onClick={() => onDragEnd({ active: { id: "a" }, over: { id: "b" } })}
    >
      drop
    </button>
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
    view.unmount();
  });
});
