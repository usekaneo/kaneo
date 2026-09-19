import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserWebSocket } from "./use-user-websocket";

vi.mock("@kaneo/libs", () => ({
  windowId: "test-window-id",
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1" } } }),
  },
}));

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

let queryClient: QueryClient;
let invalidateQueries: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderSocket() {
  const rendered = renderHook(() => useUserWebSocket(), { wrapper });
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("The hook did not open a WebSocket");
  return { ...rendered, socket };
}

function invalidatedKeys() {
  return invalidateQueries.mock.calls.map(
    ([filters]: unknown[]) => (filters as { queryKey: unknown[] }).queryKey,
  );
}

describe("useUserWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("opens the user-scoped socket for the signed-in user", () => {
    const { socket, unmount } = renderSocket();

    expect(socket.url).toBe(
      "ws://localhost:1337/api/ws/user?windowId=test-window-id",
    );

    unmount();
    expect(socket.close).toHaveBeenCalled();
  });

  it("refreshes the task and, after a short debounce, the My tasks list", () => {
    const { socket, unmount } = renderSocket();

    act(() => {
      socket.receive({ type: "ASSIGNED_TASKS_UPDATED", taskId: "task-1" });
    });

    expect(invalidatedKeys()).toEqual([["task", "task-1"]]);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(invalidatedKeys()).toEqual([["task", "task-1"], ["my-tasks"]]);
    unmount();
  });

  it("collapses a burst of updates into one My tasks refetch", () => {
    const { socket, unmount } = renderSocket();

    act(() => {
      socket.receive({ type: "ASSIGNED_TASKS_UPDATED", taskId: "task-1" });
      socket.receive({ type: "ASSIGNED_TASKS_UPDATED", taskId: "task-2" });
      socket.receive({ type: "ASSIGNED_TASKS_UPDATED" });
      vi.advanceTimersByTime(100);
    });

    expect(
      invalidatedKeys().filter(([scope]: unknown[]) => scope === "my-tasks"),
    ).toHaveLength(1);
    expect(invalidatedKeys()).toContainEqual(["task", "task-1"]);
    expect(invalidatedKeys()).toContainEqual(["task", "task-2"]);
    unmount();
  });

  it("drops a pending My tasks refresh when the hook unmounts", () => {
    const { socket, unmount } = renderSocket();

    act(() => {
      socket.receive({ type: "ASSIGNED_TASKS_UPDATED", taskId: "task-1" });
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(invalidatedKeys()).toEqual([["task", "task-1"]]);
  });

  it("leaves the My tasks cache alone for other message types", () => {
    const { socket, unmount } = renderSocket();

    act(() => {
      socket.receive({ type: "NOTIFICATION_CREATED" });
      socket.onmessage?.({ data: "not json" });
      vi.advanceTimersByTime(100);
    });

    expect(invalidatedKeys()).toEqual([["notifications"]]);
    unmount();
  });
});
