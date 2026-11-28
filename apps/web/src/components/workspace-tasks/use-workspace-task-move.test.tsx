import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import type {
  WorkspaceBoard,
  WorkspaceBoardQuery,
} from "@/fetchers/task/get-workspace-board";
import { workspaceBoardQueryKey } from "@/hooks/queries/task/use-get-workspace-board";
import useProjectStore from "@/store/project";
import { useWorkspaceTaskMove } from "./use-workspace-task-move";

const m = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutate: m.mutate }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: m.toastError } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const query: WorkspaceBoardQuery = { includeCompleted: "false" };
const key = workspaceBoardQueryKey("w", query);

function board() {
  return {
    id: "workspace-board:w",
    workspaceId: "w",
    total: 1,
    columns: [
      {
        id: "todo",
        slug: "todo",
        name: "To do",
        tasks: [{ id: "a", projectId: "p", status: "todo", title: "A" }],
      },
      { id: "doing", slug: "doing", name: "Doing", tasks: [] },
      { id: "qa", slug: "qa", name: "QA", tasks: [] },
    ],
    archivedTasks: [],
    plannedTasks: [],
    projects: [
      {
        id: "p",
        name: "Web",
        slug: "web",
        icon: null,
        columnSlugs: ["todo", "doing"],
        finalColumnSlugs: [],
      },
    ],
  } as unknown as WorkspaceBoard;
}

function setup(cached: boolean) {
  const client = new QueryClient();
  if (cached) client.setQueryData(key, board());
  const shown = board();
  const { result } = renderHook(() => useWorkspaceTaskMove("w", query, shown), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  const task = shown.columns[0].tasks[0];
  const column = (slug: string) =>
    shown.columns.find(
      (item) => item.slug === slug,
    ) as WorkspaceBoard["columns"][number];
  return { client, move: result.current, task, column };
}

const idsIn = (client: QueryClient, slug: string) =>
  client
    .getQueryData<WorkspaceBoard>(key)
    ?.columns.find((column) => column.slug === slug)
    ?.tasks.map((task) => task.id);

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.setState({ project: undefined });
});

it("moves the card at once and sends the new status", () => {
  const { client, move, task, column } = setup(true);
  // Synchronously, so the drop animation measures the card's new place.
  move(task, column("doing"));
  expect(idsIn(client, "doing")).toEqual(["a"]);
  expect(useProjectStore.getState().project?.columns[1].tasks).toHaveLength(1);
  expect(m.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ id: "a", status: "doing" }),
    expect.anything(),
  );
});

it("still sends the move while the board has no cached data", async () => {
  const { client, move, task, column } = setup(false);
  await act(() => move(task, column("doing")));
  expect(client.getQueryData(key)).toBeUndefined();
  expect(m.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ status: "doing" }),
    expect.anything(),
  );
});

it("refuses columns the task's project does not have", async () => {
  const { move, task, column } = setup(true);
  await act(() => move(task, column("qa")));
  expect(m.mutate).not.toHaveBeenCalled();
  expect(m.toastError).toHaveBeenCalledWith("workspace:tasks.moveNotAvailable");
});

it("puts the card back when the server refuses the move", async () => {
  const { client, move, task, column } = setup(true);
  await act(() => move(task, column("doing")));
  const { onError } = m.mutate.mock.calls[0][1] as { onError: () => void };
  act(() => onError());
  expect(idsIn(client, "todo")).toEqual(["a"]);
  expect(idsIn(client, "doing")).toEqual([]);
  expect(m.toastError).toHaveBeenCalledWith("workspace:tasks.moveFailed");
});
