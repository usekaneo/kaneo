import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useProjectWebSocket } from "./use-project-websocket";

const { client, auth, navigate, cached, evictProjectCache } = vi.hoisted(
  () => ({
    cached: { queries: [] as { queryKey: unknown[] }[] },
    evictProjectCache: vi.fn(),
    client: {
      getQueryCache: () => ({
        subscribe: () => () => {},
        findAll: () => cached.queries,
      }),
      getQueryState: vi.fn(),
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
      setQueriesData: vi.fn(),
      getQueriesData: vi.fn().mockReturnValue([]),
      invalidateQueries: vi.fn(),
      cancelQueries: vi.fn(),
      clear: vi.fn(),
    },
    navigate: vi.fn(),
    auth: { userId: "user-a" as string | null },
  }),
);
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: auth.userId ? { user: { id: auth.userId } } : null,
    }),
  },
}));
vi.mock("@kaneo/libs", () => ({ windowId: "local-test" }));
vi.mock("@/lib/evict-project-cache", () => ({ evictProjectCache }));

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event?: { code: number; reason?: string }) => void) | null = null;
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

describe("project WebSocket access", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", TestSocket);
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
    TestSocket.instances = [];
    auth.userId = "user-a";
    cached.queries = [];
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("clears private data and stops reconnecting after access revocation", () => {
    renderHook(() => useProjectWebSocket("project-a"));
    act(() => {
      TestSocket.instances[0].open();
      TestSocket.instances[0].onclose?.({
        code: 1008,
        reason: "Workspace access revoked",
      });
      vi.advanceTimersByTime(60_000);
    });
    expect(client.cancelQueries).toHaveBeenCalledOnce();
    expect(client.clear).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
    expect(TestSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("evicts only the revoked project and returns to its workspace dashboard", async () => {
    cached.queries = [
      { queryKey: ["projects", "workspace-a"] },
      { queryKey: ["projects", "workspace-a", "project-a"] },
    ];
    renderHook(() => useProjectWebSocket("project-a"));
    act(() => {
      TestSocket.instances[0].open();
      TestSocket.instances[0].onclose?.({
        code: 1008,
        reason: "Project access revoked",
      });
      vi.advanceTimersByTime(60_000);
    });
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: "workspace-a" },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(evictProjectCache).toHaveBeenCalledWith(client, "project-a");
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["projects"],
    });
    expect(client.clear).not.toHaveBeenCalled();
    expect(TestSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back to the dashboard when the project's workspace is unknown", () => {
    renderHook(() => useProjectWebSocket("project-a"));
    act(() => {
      TestSocket.instances[0].onclose?.({
        code: 1008,
        reason: "Project access revoked",
      });
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("reconnects after a project move without clearing authorized data", () => {
    renderHook(() => useProjectWebSocket("project-a"));
    act(() => {
      TestSocket.instances[0].onclose?.({
        code: 1008,
        reason: "Project workspace changed",
      });
      vi.advanceTimersByTime(1000);
    });
    expect(client.clear).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(TestSocket.instances).toHaveLength(2);
  });
});
