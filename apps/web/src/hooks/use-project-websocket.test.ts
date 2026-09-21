import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@kaneo/libs", () => ({
  windowId: "test-window-id",
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1" } } }),
  },
}));

import { getWsUrl, useProjectWebSocket } from "./use-project-websocket";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  send = vi.fn();

  constructor() {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.onclose?.({} as CloseEvent);
  }
}

describe("getWsUrl", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
  });

  it("builds a ws:// URL from an http API base", () => {
    expect(getWsUrl("project-123")).toBe(
      "ws://localhost:1337/api/ws/project-123?windowId=test-window-id",
    );
  });

  it("builds a wss:// URL from an https API base", () => {
    vi.stubEnv("VITE_API_URL", "https://example.com");
    expect(getWsUrl("project-123")).toBe(
      "wss://example.com/api/ws/project-123?windowId=test-window-id",
    );
  });

  it("does not append /api when the base already ends with /api", () => {
    vi.stubEnv("VITE_API_URL", "https://example.com/api");
    expect(getWsUrl("p1")).toBe(
      "wss://example.com/api/ws/p1?windowId=test-window-id",
    );
  });

  it("trims trailing slashes from the API base", () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:1337///");
    expect(getWsUrl("p1")).toBe(
      "ws://localhost:1337/api/ws/p1?windowId=test-window-id",
    );
  });

  it("URL-encodes the projectId", () => {
    expect(getWsUrl("a b/c?d")).toBe(
      "ws://localhost:1337/api/ws/a%20b%2Fc%3Fd?windowId=test-window-id",
    );
  });

  it("keeps project task queries warm for time-entry updates", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { unmount } = renderHook(() => useProjectWebSocket("project-1"), {
      wrapper,
    });

    act(() => {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "TIME_ENTRY_UPDATED",
          projectId: "project-1",
          taskId: "task-1",
        }),
      } as MessageEvent);
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["time-entries", "task-1"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["activities", "task-1"],
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ["tasks", "project-1"],
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ["task", "task-1"],
    });

    unmount();
  });
});
