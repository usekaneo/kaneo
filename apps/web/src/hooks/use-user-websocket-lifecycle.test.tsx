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

const { client, auth, navigate, evictProject } = vi.hoisted(() => ({
  client: {
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
    clear: vi.fn(),
    getQueryCache: () => ({ getAll: () => [] }),
    getQueryData: vi.fn(),
    fetchQuery: vi.fn(),
    removeQueries: vi.fn(),
    resetQueries: vi.fn(),
  },
  navigate: vi.fn(),
  evictProject: vi.fn(),
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
vi.mock("@/lib/evict-project-cache", () => ({
  evictProjectCache: evictProject,
}));
const cachedProjects = vi.fn(
  (_client: unknown, _workspaceId: string): { id: string }[] => [],
);
vi.mock("@/lib/collect-cached-projects", () => ({
  collectCachedProjects: (client: unknown, workspaceId: string) =>
    cachedProjects(client, workspaceId),
}));
function projectAccessChanged(socket: TestSocket) {
  socket.onmessage?.({
    data: JSON.stringify({
      type: "PROJECT_ACCESS_CHANGED",
      workspaceId: "workspace",
    }),
  });
}
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

  it("refreshes project lists in every tab after a project access change", () => {
    renderHook(useUserWebSocket);
    act(() => projectAccessChanged(TestSocket.instances[0]));
    for (const queryKey of [
      ["projects", "workspace"],
      ["assigned-tasks", "workspace"],
      ["search", { workspaceId: "workspace" }],
      ["workspace-activity", "workspace"],
      ["notifications"],
    ])
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey });
    expect(client.fetchQuery).not.toHaveBeenCalled();
    expect(evictProject).not.toHaveBeenCalled();
    expect(client.removeQueries).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("evicts cached data for projects that left the refreshed list", async () => {
    cachedProjects.mockReturnValueOnce([{ id: "kept" }, { id: "removed" }]);
    client.fetchQuery.mockResolvedValueOnce([{ id: "kept" }, { id: "added" }]);
    renderHook(useUserWebSocket);
    await act(async () => projectAccessChanged(TestSocket.instances[0]));
    expect(cachedProjects).toHaveBeenCalledWith(client, "workspace");
    expect(client.fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["projects", "workspace", "including-archived"],
      }),
    );
    expect(evictProject).toHaveBeenCalledOnce();
    expect(evictProject).toHaveBeenCalledWith(client, "removed");
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications"],
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps project caches when the project list refresh fails", async () => {
    cachedProjects.mockReturnValueOnce([{ id: "project" }]);
    client.fetchQuery.mockRejectedValueOnce(new Error("Network unavailable"));
    renderHook(useUserWebSocket);
    await act(async () => projectAccessChanged(TestSocket.instances[0]));
    expect(client.fetchQuery).toHaveBeenCalledOnce();
    expect(evictProject).not.toHaveBeenCalled();
  });

  it("ignores a project list refresh that finishes after the session ends", async () => {
    let finish!: (projects: { id: string }[]) => void;
    cachedProjects.mockReturnValueOnce([{ id: "project" }]);
    client.fetchQuery.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { unmount } = renderHook(useUserWebSocket);
    act(() => projectAccessChanged(TestSocket.instances[0]));
    unmount();
    await act(async () => finish([]));
    expect(evictProject).not.toHaveBeenCalled();
  });

  it("reconciles cached projects when a reconnect snapshot arrives", async () => {
    cachedProjects.mockReturnValueOnce([{ id: "kept" }, { id: "revoked" }]);
    client.fetchQuery.mockResolvedValueOnce([{ id: "kept" }]);
    renderHook(useUserWebSocket);
    await act(async () =>
      TestSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "WORKSPACE_ACCESS_SYNC",
          workspaceIds: ["workspace"],
        }),
      }),
    );
    expect(cachedProjects).toHaveBeenCalledWith(client, "workspace");
    expect(evictProject).toHaveBeenCalledWith(client, "revoked");
    expect(evictProject).toHaveBeenCalledOnce();
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
