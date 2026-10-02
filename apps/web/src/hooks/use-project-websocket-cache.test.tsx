import { cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useProjectWebSocket } from "./use-project-websocket";

const mocks = vi.hoisted(() => ({
  board: null as unknown,
  getTask: vi.fn(),
  subscribe: vi.fn(),
  client: {
    getQueryCache: () => ({
      subscribe: (listener: unknown) => {
        mocks.subscribe(listener);
        return () => {};
      },
    }),
    getQueryState: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.client,
}));
vi.mock("@kaneo/libs", () => ({ windowId: "test" }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "u" } } }) },
}));
vi.mock("@/fetchers/task/get-task", () => ({ default: mocks.getTask }));
vi.mock("@/fetchers/label/get-labels-by-task", () => ({
  default: () => Promise.resolve([]),
}));
vi.mock("@/fetchers/external-link/get-external-links", () => ({
  default: () => Promise.resolve([]),
}));

class Socket {
  static current: Socket;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor() {
    Socket.current = this;
  }
  message(type: string, rest: Record<string, unknown>) {
    this.onmessage?.({
      data: JSON.stringify({ type, projectId: "p", ...rest }),
    });
  }
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", Socket);
  mocks.board = {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [{ id: "a", projectId: "p", status: "todo", position: 0 }],
      },
      { id: "doing", slug: "doing", tasks: [] },
    ],
    plannedTasks: [],
    archivedTasks: [],
  };
  mocks.client.getQueryData.mockImplementation(() => mocks.board);
  mocks.client.setQueryData.mockImplementation((_key, value) => {
    mocks.board = typeof value === "function" ? value(mocks.board) : value;
  });
  mocks.client.invalidateQueries.mockReset();
  mocks.client.getQueryState.mockReset();
  mocks.subscribe.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("board realtime races", () => {
  it.each(["TASKS_REORDERED", "PROJECT_UPDATED", "TASK_RELATION_UPDATED"])(
    "discards a task refresh started before %s",
    async (type) => {
      let finish!: (value: unknown) => void;
      mocks.getTask.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      renderHook(() => useProjectWebSocket("p"));
      Socket.current.message("TASK_UPDATED", { taskId: "a" });
      Socket.current.message(type, {
        tasks: [{ id: "a", position: 2, status: "doing" }],
      });
      const afterEvent = mocks.board;
      finish({ id: "a", projectId: "p", status: "todo", position: 0 });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.board).toBe(afterEvent);
      if (type === "TASKS_REORDERED")
        expect(
          (mocks.board as { columns: { tasks: { id: string }[] }[] }).columns[1]
            .tasks[0].id,
        ).toBe("a");
    },
  );

  it("coalesces updates while pagination finishes without restarting page one", async () => {
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "fetching" });
    mocks.getTask.mockReset();
    mocks.getTask.mockResolvedValue({
      id: "a",
      projectId: "p",
      status: "doing",
      position: 2,
    });
    renderHook(() => useProjectWebSocket("p"));
    Socket.current.message("TASK_UPDATED", { taskId: "a" });
    Socket.current.message("TASK_UPDATED", { taskId: "a" });
    expect(mocks.getTask).not.toHaveBeenCalled();
    expect(mocks.client.invalidateQueries).not.toHaveBeenCalled();
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "idle" });
    mocks.subscribe.mock.calls[0][0]({
      query: { queryKey: ["tasks", "p"], state: { fetchStatus: "idle" } },
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.getTask).toHaveBeenCalledExactlyOnceWith("a", "board");
    expect(mocks.client.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["tasks", "p"],
    });
  });

  it("refreshes a project-wide task update with no task id", () => {
    renderHook(() => useProjectWebSocket("p"));
    Socket.current.message("TASK_UPDATED", { taskId: "" });
    expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["tasks", "p"],
    });
  });
});

it("reconciles the initial handshake after active pagination completes", async () => {
  mocks.client.getQueryState.mockReturnValue({ fetchStatus: "fetching" });
  renderHook(() => useProjectWebSocket("p"));
  Socket.current.onopen?.();
  await Promise.resolve();
  expect(mocks.client.invalidateQueries).not.toHaveBeenCalled();
  mocks.client.getQueryState.mockReturnValue({ fetchStatus: "idle" });
  mocks.subscribe.mock.calls[0][0]({
    query: { queryKey: ["tasks", "p"], state: { fetchStatus: "idle" } },
  });
  await Promise.resolve();
  expect(mocks.client.invalidateQueries).toHaveBeenCalledExactlyOnceWith({
    queryKey: ["tasks", "p"],
  });
});
it("preserves distinct task effects across pagination and a disconnect before replay", async () => {
  vi.useFakeTimers();
  try {
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "fetching" });
    mocks.getTask.mockResolvedValue({
      id: "a",
      projectId: "p",
      status: "todo",
    });
    renderHook(() => useProjectWebSocket("p"));
    Socket.current.message("COMMENT_UPDATED", { taskId: "a" });
    Socket.current.message("TASK_LABEL_UPDATED", { taskId: "a" });
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "idle" });
    mocks.subscribe.mock.calls[0][0]({
      query: { queryKey: ["tasks", "p"], state: { fetchStatus: "idle" } },
    });
    Socket.current.onclose?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    Socket.current.onopen?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["comments", "a"],
    });
    expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["labels", "a"],
    });
  } finally {
    vi.useRealTimers();
  }
});

it("does not overwrite a parent's newer progress with an older child's response", async () => {
  let finish!: (value: unknown) => void;
  mocks.getTask
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({
      id: "b",
      projectId: "p",
      status: "todo",
      parentSubtaskCounts: [{ taskId: "a", completed: 2, total: 2 }],
    });
  renderHook(() => useProjectWebSocket("p"));
  Socket.current.message("TASK_UPDATED", { taskId: "old-child" });
  Socket.current.message("TASK_UPDATED", { taskId: "b" });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  finish({
    id: "old-child",
    projectId: "p",
    status: "todo",
    parentSubtaskCounts: [{ taskId: "a", completed: 1, total: 2 }],
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const task = (
    mocks.board as {
      columns: { tasks: { id: string; subtaskCounts?: unknown }[] }[];
    }
  ).columns[0].tasks.find((task) => task.id === "a");
  expect(task?.subtaskCounts).toEqual({ completed: 2, total: 2 });
  expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["tasks", "p"],
  });
});

it("preserves newer parent progress when an earlier parent refresh finishes last", async () => {
  let finish!: (value: unknown) => void;
  mocks.getTask
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({
      id: "b",
      projectId: "p",
      status: "todo",
      parentSubtaskCounts: [{ taskId: "a", completed: 2, total: 2 }],
    });
  renderHook(() => useProjectWebSocket("p"));
  Socket.current.message("TASK_UPDATED", { taskId: "a" });
  Socket.current.message("TASK_UPDATED", { taskId: "b" });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  finish({
    id: "a",
    projectId: "p",
    status: "todo",
    subtaskCounts: { completed: 1, total: 2 },
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const task = (
    mocks.board as {
      columns: { tasks: { id: string; subtaskCounts?: unknown }[] }[];
    }
  ).columns[0].tasks.find((task) => task.id === "a");
  expect(task?.subtaskCounts).toEqual({ completed: 2, total: 2 });
});

it("bounds per-task reads during a thousand-event burst and reconciles once", async () => {
  vi.useFakeTimers();
  try {
    mocks.getTask.mockReset().mockImplementation(() => new Promise(() => {}));
    renderHook(() => useProjectWebSocket("p"));
    for (let i = 0; i < 1000; i++)
      Socket.current.message("TASK_UPDATED", { taskId: `task-${i}` });
    expect(mocks.getTask).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(200);
    expect(
      mocks.client.invalidateQueries.mock.calls.filter(
        ([options]) => options.queryKey[0] === "tasks",
      ),
    ).toHaveLength(1);
    expect(mocks.getTask).toHaveBeenCalledTimes(4);
  } finally {
    vi.useRealTimers();
  }
});

it("applies remote reorders to virtual task buckets", () => {
  const board = mocks.board as {
    plannedTasks: unknown[];
    archivedTasks: unknown[];
  };
  board.plannedTasks = [
    { id: "p1", projectId: "p", status: "planned", position: 0 },
    { id: "p2", projectId: "p", status: "planned", position: 1 },
  ];
  renderHook(() => useProjectWebSocket("p"));
  Socket.current.message("TASKS_REORDERED", {
    tasks: [
      { id: "p1", position: 1 },
      { id: "p2", position: 0 },
    ],
  });
  expect(
    (mocks.board as { plannedTasks: { id: string }[] }).plannedTasks.map(
      (task) => task.id,
    ),
  ).toEqual(["p2", "p1"]);
});

it("reconciles a remote read superseded by a narrow local mutation", async () => {
  const { markBoardCacheChanged } = await import("@/lib/board-cache-version");
  let finish!: (value: unknown) => void;
  mocks.getTask.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderHook(() => useProjectWebSocket("p"));
  Socket.current.message("TASK_UPDATED", { taskId: "a" });
  markBoardCacheChanged(mocks.client as never, "p", "a");
  finish({ id: "a", projectId: "p", status: "todo", dueDate: "2026-10-01" });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["tasks", "p"],
  });
});

it("applies a remote reorder across virtual buckets without waiting for HTTP", () => {
  const board = mocks.board as {
    columns: {
      tasks: { id: string; status: string; columnId: string | null }[];
    }[];
    plannedTasks: {
      id: string;
      projectId: string;
      status: string;
      position: number;
    }[];
  };
  board.plannedTasks = [
    { id: "planned", projectId: "p", status: "planned", position: 0 },
  ];
  renderHook(() => useProjectWebSocket("p"));
  Socket.current.message("TASKS_REORDERED", {
    tasks: [
      { id: "planned", position: 1, status: "todo" },
      { id: "a", position: 0, status: "archived" },
    ],
  });
  expect((mocks.board as typeof board).plannedTasks).toEqual([]);
  expect((mocks.board as typeof board).columns[0].tasks).toContainEqual(
    expect.objectContaining({ id: "planned", status: "todo" }),
  );
  expect(
    (mocks.board as { archivedTasks: unknown[] }).archivedTasks,
  ).toContainEqual(
    expect.objectContaining({ id: "a", status: "archived", columnId: null }),
  );
});

it.each(["TASK_CREATED", "TASK_DELETED", "TASK_MOVED", "TASKS_REORDERED"])(
  "reconciles page boundaries after %s arrives during pagination",
  async (type) => {
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "fetching" });
    mocks.getTask.mockReset();
    renderHook(() => useProjectWebSocket("p"));
    Socket.current.message(type, {
      taskId: "a",
      tasks: [{ id: "a", position: 2 }],
    });
    Socket.current.message(type, {
      taskId: "b",
      tasks: [{ id: "b", position: 0 }],
    });
    expect(mocks.client.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["tasks", "p"],
    });
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "idle" });
    mocks.client.invalidateQueries.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "tasks")
        mocks.client.getQueryState.mockReturnValue({ fetchStatus: "fetching" });
    });
    const idle = () =>
      mocks.subscribe.mock.calls[0][0]({
        query: { queryKey: ["tasks", "p"], state: { fetchStatus: "idle" } },
      });
    idle();
    await Promise.resolve();
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "idle" });
    idle();
    await Promise.resolve();
    expect(
      mocks.client.invalidateQueries.mock.calls.filter(
        ([options]) => options.queryKey[0] === "tasks",
      ),
    ).toHaveLength(1);
    expect(mocks.getTask).not.toHaveBeenCalled();
  },
);

it.each(["TASK_UPDATED", "TASK_CREATED", "TASK_MOVED", "TASK_LABEL_UPDATED"])(
  "keeps detail invalidation without board-only reads for %s",
  (type) => {
    mocks.board = undefined;
    mocks.getTask.mockReset();
    renderHook(() => useProjectWebSocket("p"));
    Socket.current.message(type, { taskId: "a" });
    expect(mocks.getTask).not.toHaveBeenCalled();
    expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["task", "a"],
    });
  },
);

it("drains queued detail events after retries fall back to polling", async () => {
  vi.useFakeTimers();
  try {
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "fetching" });
    renderHook(() => useProjectWebSocket("p"));
    Socket.current.message("COMMENT_UPDATED", { taskId: "a" });
    Socket.current.message("TASK_LABEL_UPDATED", { taskId: "a" });
    Socket.current.message("TASK_UPDATED", { taskId: "a" });
    Socket.current.message("TASK_RELATION_UPDATED", {
      sourceTaskId: "a",
      targetTaskId: "b",
    });
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      Socket.current.onclose?.();
      await vi.advanceTimersByTimeAsync(delay);
    }
    Socket.current.onclose?.();
    mocks.client.invalidateQueries.mockClear();
    mocks.getTask.mockClear();
    mocks.client.getQueryState.mockReturnValue({ fetchStatus: "idle" });
    const listener = mocks.subscribe.mock.calls[0][0] as (
      event: unknown,
    ) => void;
    listener({
      query: { queryKey: ["tasks", "p"], state: { fetchStatus: "idle" } },
    });
    await vi.runAllTicks();
    for (const key of [
      ["comments", "a"],
      ["activities", "a"],
      ["labels", "a"],
      ["task", "a"],
      ["external-links", "a"],
      ["task-relations", "b"],
    ])
      expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
        queryKey: key,
      });
    expect(mocks.getTask).not.toHaveBeenCalled();
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});

it("refreshes workspace label filters when a remote project event changes labels", async () => {
  renderHook(() => useProjectWebSocket("p"));
  Socket.current.message("PROJECT_UPDATED", {});
  await vi.waitFor(() =>
    expect(mocks.client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["labels"],
    }),
  );
});
