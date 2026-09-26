import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectWebSocket } from "./use-project-websocket";

const { client, auth } = vi.hoisted(() => ({
  client: { invalidateQueries: vi.fn() },
  auth: { userId: "user-a" as string | null },
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: auth.userId ? { user: { id: auth.userId } } : null,
    }),
  },
}));
vi.mock("@kaneo/libs", () => ({ windowId: "local-test" }));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  // Deliberately delay close events to reproduce the project-switch race.
  close = vi.fn(() => {
    this.readyState = 3;
  });
  constructor(public url: string) {
    TestSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe("project WebSocket lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", TestSocket);
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
    TestSocket.instances = [];
    auth.userId = "user-a";
    client.invalidateQueries.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ignores late old-project events without stopping the new project's keepalive", () => {
    const { rerender, unmount } = renderHook(
      ({ id }) => useProjectWebSocket(id),
      { initialProps: { id: "project-a" } },
    );
    const old = TestSocket.instances[0];
    act(() => old.open());
    rerender({ id: "project-b" });
    const current = TestSocket.instances[1];
    act(() => {
      current.open();
      old.onclose?.();
      old.onopen?.();
      old.onmessage?.({
        data: JSON.stringify({
          type: "TASK_UPDATED",
          projectId: "project-a",
          taskId: "old-task",
        }),
      });
      vi.advanceTimersByTime(30_000);
    });
    expect(
      TestSocket.instances.map((socket) => new URL(socket.url).pathname),
    ).toEqual(["/api/ws/project-a", "/api/ws/project-b"]);
    expect(old.close).toHaveBeenCalledOnce();
    expect(old.send).not.toHaveBeenCalled();
    expect(current.send).toHaveBeenCalledWith('{"type":"ping"}');
    expect(client.invalidateQueries).not.toHaveBeenCalled();
    unmount();
    act(() => current.onclose?.());
    expect(current.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels scheduled reconnects on logout and starts a fresh connection on login", () => {
    const { rerender, unmount } = renderHook(() =>
      useProjectWebSocket("project-a"),
    );
    act(() => TestSocket.instances[0].onclose?.());
    expect(vi.getTimerCount()).toBe(1);
    auth.userId = null;
    rerender();
    act(() => vi.advanceTimersByTime(60_000));
    expect(TestSocket.instances).toHaveLength(1);
    auth.userId = "user-b";
    rerender();
    expect(TestSocket.instances).toHaveLength(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refreshes project and task caches when the workspace changes", () => {
    renderHook(() => useProjectWebSocket("project-a"));
    act(() =>
      TestSocket.instances[0].onmessage?.({
        data: JSON.stringify({ type: "PROJECT_MOVED", projectId: "project-a" }),
      }),
    );
    for (const queryKey of [
      ["projects"],
      ["project", "project-a"],
      ["tasks", "project-a"],
      ["task"],
      ["task-relations"],
    ]) {
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
  });

  it("preserves bounded exponential reconnects and active message invalidation", () => {
    const { unmount } = renderHook(() => useProjectWebSocket("project-a"));
    for (let retry = 0; retry < 5; retry++) {
      act(() => {
        TestSocket.instances.at(-1)?.onclose?.();
        vi.advanceTimersByTime(1000 * 2 ** retry);
      });
      expect(TestSocket.instances).toHaveLength(retry + 2);
    }
    const last = TestSocket.instances.at(-1);
    act(() => {
      last?.onmessage?.({
        data: JSON.stringify({
          type: "TASK_UPDATED",
          projectId: "project-a",
          taskId: "task-a",
        }),
      });
      last?.onclose?.();
      vi.advanceTimersByTime(60_000);
    });
    expect(TestSocket.instances).toHaveLength(6);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["tasks", "project-a"],
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["task", "task-a"],
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
