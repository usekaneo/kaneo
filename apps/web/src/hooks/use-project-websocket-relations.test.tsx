import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vite-plus/test";

vi.mock("@kaneo/libs", () => ({
  windowId: "test-window-id",
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1" } } }),
  },
}));

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { useProjectWebSocket } from "./use-project-websocket";

type Socket = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

describe("useProjectWebSocket relation invalidation", () => {
  let socket: Socket;
  let invalidate: MockInstance<QueryClient["invalidateQueries"]>;

  function mount() {
    const client = new QueryClient();
    invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined);

    renderHook(
      () => {
        useQueryClient();
        return useProjectWebSocket("project-1");
      },
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client }, children),
      },
    );
  }

  function receive(message: Record<string, unknown>) {
    socket.onmessage?.({ data: JSON.stringify(message) });
  }

  function invalidatedKeys() {
    return invalidate.mock.calls.map((call) =>
      JSON.stringify(call[0]?.queryKey),
    );
  }

  const projectRelationsKey = JSON.stringify([
    "task-relations",
    "project",
    "project-1",
  ]);

  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
    socket = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
    // `new WebSocket(url)` needs a constructible mock, so this cannot be an
    // arrow function.
    vi.stubGlobal(
      "WebSocket",
      Object.assign(
        vi.fn(function mockWebSocket() {
          return socket;
        }),
        { OPEN: 1 },
      ),
    );
    mount();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // A relation changed while the socket was down sends no message once it is
  // back, so reconnecting refetches the hierarchy along with the board.
  it("refreshes the project relations when the socket opens", async () => {
    socket.onopen?.();
    await Promise.resolve();

    expect(invalidatedKeys()).toContain(projectRelationsKey);
  });

  it("refreshes the project relations while polling without a socket", () => {
    vi.useFakeTimers();
    try {
      for (let attempt = 0; attempt <= 5; attempt++) {
        socket.onclose?.();
        vi.advanceTimersByTime(20_000);
      }
      invalidate.mockClear();

      vi.advanceTimersByTime(30_000);

      expect(invalidatedKeys()).toContain(projectRelationsKey);
    } finally {
      vi.useRealTimers();
    }
  });

  // The project-scoped relations query is what the list view reads, and no
  // per-task key reaches it.
  it("refreshes the project relations on a real relation change", () => {
    receive({
      type: "TASK_RELATION_UPDATED",
      projectId: "project-1",
      sourceTaskId: "task-1",
      targetTaskId: "task-2",
    });

    expect(invalidatedKeys()).toContain(projectRelationsKey);
  });

  it.each(["TASK_DELETED", "TASK_MOVED"])(
    "refreshes the project relations on %s",
    (type) => {
      receive({ type, projectId: "project-1", taskId: "task-1" });

      expect(invalidatedKeys()).toContain(projectRelationsKey);
    },
  );

  // The API publishes task-relation.refresh on every status change, and the
  // socket relays it as TASK_RELATION_UPDATED with no endpoint ids. That
  // stales the per-task queries, whose responses embed each linked task's
  // status, but not the project query, which returns edges alone.
  it("does not refresh the project relations on a status refresh", () => {
    receive({ type: "TASK_RELATION_UPDATED", projectId: "project-1" });

    expect(invalidatedKeys()).not.toContain(projectRelationsKey);
  });

  it("still refreshes the per-task relations on a status refresh", () => {
    receive({ type: "TASK_RELATION_UPDATED", projectId: "project-1" });

    const predicates = invalidate.mock.calls
      .map((call) => call[0]?.predicate)
      .filter(Boolean);
    expect(predicates).toHaveLength(1);

    const matches = (queryKey: readonly unknown[]) =>
      // biome-ignore lint/suspicious/noExplicitAny: only queryKey is read
      predicates[0]?.({ queryKey } as any);

    expect(matches(["task-relations", "task-9"])).toBe(true);
    expect(matches(["task-relations", "project", "project-1"])).toBe(false);
  });

  // Creating a task inserts no relation: a subtask is a create followed by a
  // separate relation mutation, which emits its own event.
  it.each([
    "TASK_CREATED",
    "TASK_UPDATED",
    "TASK_LABEL_UPDATED",
    "COMMENT_UPDATED",
  ])("leaves the project relations alone on %s", (type) => {
    receive({ type, projectId: "project-1", taskId: "task-1" });

    expect(invalidatedKeys()).not.toContain(projectRelationsKey);
  });

  it("ignores a malformed message", () => {
    expect(() => socket.onmessage?.({ data: "{not json" })).not.toThrow();
  });
});
