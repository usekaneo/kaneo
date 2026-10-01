import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useUserWebSocket } from "./use-user-websocket";

const { client, auth, navigate } = vi.hoisted(() => ({
  client: {
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
    clear: vi.fn(),
    getQueryCache: () => ({ getAll: () => [] }),
    removeQueries: vi.fn(),
    resetQueries: vi.fn(),
  },
  navigate: vi.fn(),
  auth: {
    userId: "user-a" as string | null,
    workspaceId: "workspace",
    pathname: "",
    notify: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useLocation: () =>
    auth.pathname || `/dashboard/workspace/${auth.workspaceId}`,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    $store: { notify: auth.notify },
    signOut: auth.signOut,
    useSession: () => ({
      data: auth.userId
        ? {
            user: { id: auth.userId },
            session: { activeOrganizationId: auth.workspaceId },
          }
        : null,
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
    auth.workspaceId = "workspace";
    auth.pathname = "";
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it.each([
    "/dashboard/settings/workspace/general",
    "/dashboard/settings/workspace/roles",
    "/dashboard/settings/projects/general",
  ])("redirects a revoked active workspace from %s", (path) => {
    auth.pathname = path;
    renderHook(useUserWebSocket);
    act(() =>
      TestSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "WORKSPACE_ACCESS_REVOKED",
          workspaceId: "workspace",
        }),
      }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });
  it("clears revoked workspace data from the global user connection", () => {
    renderHook(() => useUserWebSocket());
    act(() =>
      TestSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "WORKSPACE_ACCESS_REVOKED",
          workspaceId: "workspace",
          pathname: "",
        }),
      }),
    );
    expect(client.cancelQueries).toHaveBeenCalledOnce();
    expect(client.removeQueries).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
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
  it("keeps retrying through long outages with bounded delays and one timer", () => {
    const { unmount } = renderHook(useUserWebSocket);
    for (const [retry, delay] of [
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ].entries()) {
      act(() => {
        const current = TestSocket.instances.at(-1);
        current?.onclose?.();
        current?.onclose?.();
        vi.advanceTimersByTime(delay - 1);
      });
      expect(TestSocket.instances).toHaveLength(retry + 1);
      expect(vi.getTimerCount()).toBe(1);
      act(() => vi.advanceTimersByTime(1));
      expect(TestSocket.instances).toHaveLength(retry + 2);
    }
    act(() => {
      const socket = TestSocket.instances.at(-1)!;
      socket.open();
      socket.onmessage?.({
        data: JSON.stringify({
          type: "WORKSPACE_ACCESS_SYNC",
          workspaceIds: [],
        }),
      });
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps users in their current workspace when an inactive membership is revoked", () => {
    auth.workspaceId = "other-workspace";
    renderHook(() => useUserWebSocket());
    TestSocket.instances[0].onmessage?.({
      data: JSON.stringify({
        type: "WORKSPACE_ACCESS_REVOKED",
        workspaceId: "workspace",
        pathname: "",
      }),
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(client.removeQueries).toHaveBeenCalledOnce();
    expect(auth.notify).toHaveBeenCalledWith("$listOrg");
    expect(auth.notify).toHaveBeenCalledWith("$activeOrgSignal");
    expect(auth.notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("redirects after a reconnect snapshot reveals a missed workspace revocation", () => {
    renderHook(useUserWebSocket);
    act(() =>
      TestSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "WORKSPACE_ACCESS_SYNC",
          workspaceIds: ["other"],
        }),
      }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
    expect(client.removeQueries).toHaveBeenCalledOnce();
    expect(auth.notify).toHaveBeenCalledWith("$listOrg");
    expect(auth.notify).toHaveBeenCalledWith("$activeOrgSignal");
  });
});

it("clears all private caches and signs out after account-wide revocation", async () => {
  vi.stubGlobal("WebSocket", TestSocket);
  auth.userId = "user-a";
  renderHook(useUserWebSocket);
  const socket = TestSocket.instances.at(-1)!;
  socket.onmessage?.({ data: JSON.stringify({ type: "USER_ACCESS_REVOKED" }) });
  socket.onclose?.();
  await Promise.resolve();
  expect(client.clear).toHaveBeenCalled();
  expect(auth.signOut).toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith({ to: "/auth/sign-in" });
  cleanup();
  vi.unstubAllGlobals();
});
