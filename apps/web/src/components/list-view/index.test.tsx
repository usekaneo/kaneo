import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { DragEndEvent } from "@dnd-kit/core";
import type { ProjectWithTasks } from "@/types/project";
import ListView from "./index";
const m = vi.hoisted(() => ({
  props: {} as {
    sensors?: unknown[];
    onDragEnd?: (event: DragEndEvent) => void;
  },
  archive: {} as {
    onConfirm?: () => void;
    disabled?: boolean;
    taskCount?: number;
  },
  mutate: vi.fn(),
  setProject: vi.fn(),
}));
vi.mock("@dnd-kit/core", async (original) => ({
  ...(await original<typeof import("@dnd-kit/core")>()),
  DndContext: (props: typeof m.props & { children: React.ReactNode }) => {
    m.props = props;
    return props.children;
  },
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: () => {},
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutate: m.mutate }),
}));
vi.mock("@/store/project", () => ({
  default: () => ({ setProject: m.setProject }),
}));
vi.mock("./task-row", () => ({ default: () => null }));
vi.mock("../bulk-selection/bulk-toolbar", () => ({ default: () => null }));
vi.mock("../shared/modals/create-task-modal", () => ({ default: () => null }));
vi.mock("../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: (props: typeof m.archive) => {
    m.archive = props;
    return null;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("disables keyboard sensors and rejects drag completion on a partial board", () => {
  const project = {
    id: "p",
    workspaceId: "w",
    columns: [
      {
        id: "todo",
        slug: "todo",
        name: "To do",
        tasks: [
          { id: "a", position: 0 },
          { id: "b", position: 1 },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  const { rerender } = render(<ListView project={project} />);
  expect(m.props.sensors?.length).toBeGreaterThan(0);
  rerender(<ListView project={project} disableDragDrop />);
  expect(m.props.sensors).toEqual([]);
  act(() =>
    m.props.onDragEnd?.({
      active: { id: "a" },
      over: { id: "b" },
    } as DragEndEvent),
  );
  expect(m.mutate).not.toHaveBeenCalled();
  expect(m.setProject).not.toHaveBeenCalled();
});

it("blocks archive-all during pagination or errors, including an already-open confirmation", () => {
  const column = {
    id: "done",
    name: "Done",
    slug: "done",
    isFinal: true,
    tasks: [{ id: "a" }],
  };
  const project = {
    id: "p",
    workspaceId: "w",
    columns: [column],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  const { rerender } = render(<ListView project={project} />);
  fireEvent.click(screen.getByTitle(/archiveAllTooltip/));
  const complete = {
    ...project,
    columns: [
      {
        ...project.columns[0],
        tasks: [...project.columns[0].tasks, { id: "b" }],
      },
    ],
  } as unknown as ProjectWithTasks;
  rerender(<ListView project={complete} disableCollectionActions />);
  expect(screen.getByTitle(/archiveAllTooltip/).hasAttribute("disabled")).toBe(
    true,
  );
  expect(m.archive.disabled).toBe(true);
  act(() => m.archive.onConfirm?.());
  expect(m.mutate).not.toHaveBeenCalled();
  expect(m.setProject).not.toHaveBeenCalled();
  rerender(<ListView project={complete} />);
  expect(m.archive.taskCount).toBe(2);
  act(() => m.archive.onConfirm?.());
  expect(m.mutate).toHaveBeenCalledTimes(2);
  expect(m.setProject).toHaveBeenCalledOnce();
});
