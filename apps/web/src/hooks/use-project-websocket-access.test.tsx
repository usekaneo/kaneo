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

const { client, auth, navigate } = vi.hoisted(() => ({
  client: {
    getQueryCache: () => ({ subscribe: () => () => {} }),
    getQueryState: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
    clear: vi.fn(),
  },
  navigate: vi.fn(),
  auth: { userId: "user-a" as string | null },
}));
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
