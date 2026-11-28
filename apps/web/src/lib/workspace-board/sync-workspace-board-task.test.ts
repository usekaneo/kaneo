import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import type { ProjectWithTasks } from "@/types/project";
import {
  removeWorkspaceBoardTask,
  syncWorkspaceBoardTask,
} from "./sync-workspace-board-task";

const getTask = vi.hoisted(() => vi.fn());
const getLabelsByTask = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/task/get-task", () => ({ default: getTask }));
vi.mock("@/fetchers/label/get-labels-by-task", () => ({
  default: getLabelsByTask,
}));

const key = ["workspace-board", "w", { includeCompleted: "false" }];

function board() {
  return {
    id: "workspace-board:w",
    columns: [
      {
        id: "todo",
        slug: "todo",
        isFinal: false,
        tasks: [
          {
            id: "a",
            projectId: "p",
            projectSlug: "P",
            status: "todo",
            title: "old",
            createdAt: "2026-01-01",
          },
        ],
      },
      { id: "doing", slug: "doing", isFinal: false, tasks: [] },
    ],
    archivedTasks: [],
    plannedTasks: [],
    projects: [{ id: "p" }],
  } as unknown as ProjectWithTasks;
}

function tasksOf(client: QueryClient, column: number) {
  return client
    .getQueryData<ProjectWithTasks>(key)
    ?.columns[column].tasks.map((task) => `${task.id}:${task.title}`);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Put a board in the cache with a mounted observer, as the page would. */
function show(client: QueryClient, data: ProjectWithTasks = board()) {
  client.setQueryData(key, data);
  new QueryObserver(client, { queryKey: key, enabled: false }).subscribe(
    () => undefined,
  );
}

describe("syncWorkspaceBoardTask", () => {
  beforeEach(() => {
    getTask.mockReset();
    getLabelsByTask.mockReset();
    getLabelsByTask.mockResolvedValue([]);
  });

  it("leaves boards alone that are only cached", async () => {
    const client = new QueryClient();
    client.setQueryData(key, board());
    syncWorkspaceBoardTask(client, { id: "a", projectId: "p" }, { title: "x" });
    removeWorkspaceBoardTask(client, "a");
    await flush();
    expect(getTask).not.toHaveBeenCalled();
    expect(tasksOf(client, 0)).toEqual(["a:old"]);
  });

  it("waits for a running load and applies the change on top of it", async () => {
    const client = new QueryClient();
    show(client);
    let finish: (value: ProjectWithTasks) => void = () => undefined;
    void client.fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise<ProjectWithTasks>((resolve) => (finish = resolve)),
    });
    syncWorkspaceBoardTask(
      client,
      { id: "a", projectId: "p" },
      { title: "mine" },
      { refresh: false },
    );
    removeWorkspaceBoardTask(client, "missing");
    expect(tasksOf(client, 0)).toEqual(["a:old"]);
    finish(board());
    await flush();
    expect(client.getQueryState(key)?.fetchStatus).toBe("idle");
    expect(tasksOf(client, 0)).toEqual(["a:mine"]);
  });

  it("does nothing without a loaded board", () => {
    const client = new QueryClient();
    syncWorkspaceBoardTask(client, { id: "a", projectId: "p" }, { title: "x" });
    expect(getTask).not.toHaveBeenCalled();
  });

  it("applies known fields at once and the server state afterwards", async () => {
    const client = new QueryClient();
    show(client);
    getTask.mockResolvedValue({
      id: "a",
      projectId: "p",
      status: "doing",
      title: "server",
      createdAt: "2026-01-01",
    });
    getLabelsByTask.mockResolvedValue([{ id: "l", name: "Bug", color: "red" }]);
    syncWorkspaceBoardTask(
      client,
      { id: "a", projectId: "p" },
      { title: "mine" },
    );
    expect(tasksOf(client, 0)).toEqual(["a:mine"]);
    await flush();
    expect(tasksOf(client, 0)).toEqual([]);
    expect(tasksOf(client, 1)).toEqual(["a:server"]);
    const task =
      client.getQueryData<ProjectWithTasks>(key)?.columns[1].tasks[0];
    expect(task).toMatchObject({ projectSlug: "P", labels: [{ id: "l" }] });
  });

  it("skips the server read when asked", async () => {
    const client = new QueryClient();
    show(client);
    syncWorkspaceBoardTask(
      client,
      { id: "a", projectId: "p" },
      { title: "mine" },
      { refresh: false },
    );
    await flush();
    expect(getTask).not.toHaveBeenCalled();
    expect(tasksOf(client, 0)).toEqual(["a:mine"]);
  });

  it("lets the latest edit win over a slower earlier read", async () => {
    const client = new QueryClient();
    show(client);
    let resolveFirst: (value: unknown) => void = () => undefined;
    getTask
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce({
        id: "a",
        projectId: "p",
        status: "todo",
        title: "second",
        createdAt: "2026-01-01",
      });
    syncWorkspaceBoardTask(client, { id: "a", projectId: "p" });
    syncWorkspaceBoardTask(client, { id: "a", projectId: "p" });
    await flush();
    expect(tasksOf(client, 0)).toEqual(["a:second"]);
    resolveFirst({
      id: "a",
      projectId: "p",
      status: "todo",
      title: "first",
      createdAt: "2026-01-01",
    });
    await flush();
    expect(tasksOf(client, 0)).toEqual(["a:second"]);
  });

  it("removes a task the server no longer knows", async () => {
    const client = new QueryClient();
    show(client);
    getTask.mockRejectedValue(new HttpError(404, "gone"));
    syncWorkspaceBoardTask(client, { id: "a", projectId: "p" });
    await flush();
    expect(tasksOf(client, 0)).toEqual([]);
  });

  it("falls back to a reload on other errors", async () => {
    const client = new QueryClient();
    show(client);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    getTask.mockRejectedValue(new Error("boom"));
    syncWorkspaceBoardTask(client, { id: "a", projectId: "p" });
    await flush();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["workspace-board"] });
  });

  it("removes tasks directly", () => {
    const client = new QueryClient();
    show(client);
    removeWorkspaceBoardTask(client, "a");
    expect(tasksOf(client, 0)).toEqual([]);
  });
});
