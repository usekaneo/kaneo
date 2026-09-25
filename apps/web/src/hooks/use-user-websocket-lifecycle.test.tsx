import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserWebSocket } from "./use-user-websocket";

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
describe("user WebSocket lifecycle", () => {
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
  it("ignores events from an old account without stopping the new account's keepalive", () => {
    const { rerender, unmount } = renderHook(useUserWebSocket);
    const old = TestSocket.instances[0];
    act(() => old.open());
    auth.userId = "user-b";
    rerender();
    const current = TestSocket.instances[1];
    act(() => {
      current.open();
      old.onclose?.();
      old.onopen?.();
      old.onmessage?.({
        data: JSON.stringify({ type: "NOTIFICATION_CREATED" }),
      });
      vi.advanceTimersByTime(30_000);
    });
    expect(TestSocket.instances).toHaveLength(2);
    expect(old.close).toHaveBeenCalledOnce();
    expect(old.send).not.toHaveBeenCalled();
    expect(current.send).toHaveBeenCalledWith('{"type":"ping"}');
    expect(client.invalidateQueries).not.toHaveBeenCalled();
    act(() =>
      current.onmessage?.({
        data: JSON.stringify({ type: "NOTIFICATION_CREATED" }),
      }),
    );
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications"],
    });
    unmount();
    act(() => current.onclose?.());
    expect(current.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels reconnects on logout and rejects stale messages from a closed socket", () => {
    const { rerender, unmount } = renderHook(useUserWebSocket);
    const old = TestSocket.instances[0];
    act(() => {
      old.onclose?.();
      old.onmessage?.({
        data: JSON.stringify({ type: "NOTIFICATION_CREATED" }),
      });
    });
    expect(client.invalidateQueries).not.toHaveBeenCalled();
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
  it("retains the five-retry limit and does not duplicate retries on repeated close events", () => {
    const { unmount } = renderHook(useUserWebSocket);
    for (let retry = 0; retry < 5; retry++) {
      act(() => {
        const current = TestSocket.instances.at(-1);
        current?.onclose?.();
        current?.onclose?.();
        vi.advanceTimersByTime(1000 * 2 ** retry);
      });
      expect(TestSocket.instances).toHaveLength(retry + 2);
    }
    act(() => {
      TestSocket.instances.at(-1)?.onclose?.();
      vi.advanceTimersByTime(60_000);
    });
    expect(TestSocket.instances).toHaveLength(6);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
