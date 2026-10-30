import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import TaskMovePopover from "./task-move-popover";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  moveTask: vi.fn(),
  fetchQuery: vi.fn(),
  columns: [] as { slug: string; name: string; isFinal: boolean }[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "project-1", name: "Website", icon: null },
      { id: "project-2", name: "Mobile app", icon: null },
    ],
  }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: mocks.columns,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/mutations/task/use-move-task", () => ({
  useMoveTask: () => ({ mutateAsync: mocks.moveTask }),
}));
vi.mock("@/query-client", () => ({
  default: { fetchQuery: mocks.fetchQuery },
}));
vi.mock("@/fetchers/column/get-columns", () => ({ default: vi.fn() }));
vi.mock("@/lib/i18n/domain", () => ({
  getStatusDisplayLabel: (_slug: string, name: string) => name,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const task = {
  id: "task-1",
  title: "Fix login",
  number: 1,
  status: "in-review",
  projectId: "project-1",
} as Task;

async function pickMobileApp() {
  render(
    <TaskMovePopover task={task} workspaceId="workspace-1">
      <button type="button">Move</button>
    </TaskMovePopover>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Move" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("option", { name: /Mobile app/ }));
  });
}

describe("TaskMovePopover", () => {
  it("moves right away when the destination has the same status", async () => {
    mocks.fetchQuery.mockResolvedValue([
      { slug: "in-review", name: "In Review", isFinal: false },
    ]);
    mocks.moveTask.mockResolvedValue({ task: { projectId: "project-2" } });

    await pickMobileApp();

    expect(mocks.moveTask).toHaveBeenCalledWith({
      taskId: "task-1",
      destinationProjectId: "project-2",
      destinationStatus: "in-review",
    });
  });

  it("asks for a status when the destination workflow lacks it", async () => {
    mocks.fetchQuery.mockResolvedValue([
      { slug: "to-do", name: "To Do", isFinal: false },
    ]);
    mocks.columns = [{ slug: "to-do", name: "To Do", isFinal: false }];
    mocks.moveTask.mockResolvedValue({ task: { projectId: "project-2" } });

    await pickMobileApp();
    expect(mocks.moveTask).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(await screen.findByRole("option", { name: /To Do/ }));
    });

    expect(mocks.moveTask).toHaveBeenCalledWith({
      taskId: "task-1",
      destinationProjectId: "project-2",
      destinationStatus: "to-do",
    });
  });
});
