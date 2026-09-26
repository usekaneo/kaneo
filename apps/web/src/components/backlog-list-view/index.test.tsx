import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardShortcutsProvider } from "@/hooks/use-keyboard-shortcuts";
import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import BacklogListView from "./index";

const { mountRow, unmountRow, renderRow, navigate } = vi.hoisted(() => ({
  mountRow: vi.fn(),
  unmountRow: vi.fn(),
  renderRow: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("./backlog-task-row", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({ task }: { task: Task }) => {
      renderRow(task.id);
      useEffect(() => {
        mountRow(task.id);
        return () => unmountRow(task.id);
      }, [task.id]);
      return <input aria-label={task.id} defaultValue={task.title} />;
    },
  };
});

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
}));
vi.mock("../shared/modals/create-task-modal", () => ({
  default: ({ open, status }: { open: boolean; status: string }) =>
    open ? <div role="dialog">{status}</div> : null,
}));
vi.mock("../bulk-selection/backlog-bulk-toolbar", () => ({
  default: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

function makeTasks(status: string, count: number): Task[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${status}-${index}`,
    title: `${status} task ${index}`,
    status,
    number: index,
    description: null,
    priority: null,
    startDate: null,
    dueDate: null,
    position: index,
    createdAt: "2026-09-16T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
  }));
}

const project: ProjectWithTasks = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Imported project",
  slug: "IMP",
  icon: null,
  description: null,
  isPublic: false,
  columns: [],
  // Exact lifecycle counts catch remounts without a large DOM slowing CI.
  plannedTasks: makeTasks("planned", 2),
  archivedTasks: makeTasks("archived", 3),
};

const totalTaskCount =
  project.plannedTasks.length + project.archivedTasks.length;

beforeEach(() => {
  useBacklogBulkSelectionStore.setState(
    useBacklogBulkSelectionStore.getInitialState(),
  );
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("backlog row lifecycle", () => {
  it("mounts each row once and preserves the other section when collapsing and expanding", () => {
    render(<BacklogListView project={project} />, {
      wrapper: KeyboardShortcutsProvider,
    });
    expect(mountRow).toHaveBeenCalledTimes(totalTaskCount);
    expect(unmountRow).not.toHaveBeenCalled();

    const archivedRow = screen.getByLabelText("archived-0");
    fireEvent.change(archivedRow, { target: { value: "Local row state" } });
    mountRow.mockClear();
    const plannedToggle = screen.getByRole("button", {
      name: /tasks:backlog.sections.planned/,
    });
    fireEvent.click(plannedToggle);

    expect(plannedToggle).toHaveAttribute("aria-expanded", "false");
    expect(mountRow).not.toHaveBeenCalled();
    expect(unmountRow).toHaveBeenCalledTimes(project.plannedTasks.length);
    expect(screen.getByLabelText("archived-0")).toBe(archivedRow);
    expect(archivedRow).toHaveValue("Local row state");
    expect(useBacklogBulkSelectionStore.getState().availableTaskIds).toEqual(
      project.archivedTasks.map((task) => task.id),
    );

    fireEvent.click(plannedToggle);
    expect(plannedToggle).toHaveAttribute("aria-expanded", "true");
    expect(mountRow).toHaveBeenCalledTimes(project.plannedTasks.length);
    expect(unmountRow).toHaveBeenCalledTimes(project.plannedTasks.length);
    expect(archivedRow).toHaveValue("Local row state");
    expect(
      useBacklogBulkSelectionStore.getState().availableTaskIds,
    ).toHaveLength(totalTaskCount);
  });

  it("does not render the list again on selection or keyboard focus changes", () => {
    render(<BacklogListView project={project} />, {
      wrapper: KeyboardShortcutsProvider,
    });
    renderRow.mockClear();
    mountRow.mockClear();

    act(() =>
      useBacklogBulkSelectionStore.getState().toggleSelection("planned-0"),
    );
    fireEvent.keyDown(document.body, { key: "j" });
    expect(navigate).toHaveBeenLastCalledWith({
      to: ".",
      search: { taskId: "planned-0" },
    });
    fireEvent.keyDown(document.body, { key: "j" });
    expect(navigate).toHaveBeenLastCalledWith({
      to: ".",
      search: { taskId: "planned-1" },
    });
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: "workspace-1",
        projectId: "project-1",
        taskId: "planned-1",
      },
    });
    fireEvent.keyDown(document.body, { key: "k" });
    expect(navigate).toHaveBeenLastCalledWith({
      to: ".",
      search: { taskId: "planned-0" },
    });
    expect(renderRow).not.toHaveBeenCalled();
    expect(mountRow).not.toHaveBeenCalled();
    expect(unmountRow).not.toHaveBeenCalled();
  });

  it("preserves rows when opening task creation or receiving updated task data", () => {
    const { rerender } = render(<BacklogListView project={project} />, {
      wrapper: KeyboardShortcutsProvider,
    });
    const archivedRow = screen.getByLabelText("archived-0");
    mountRow.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:backlog.addTask" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("planned");
    rerender(
      <BacklogListView
        project={{ ...project, archivedTasks: [...project.archivedTasks] }}
      />,
    );
    expect(screen.getByLabelText("archived-0")).toBe(archivedRow);
    expect(mountRow).not.toHaveBeenCalled();
    expect(unmountRow).not.toHaveBeenCalled();
  });
});
