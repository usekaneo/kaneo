import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@kaneo/libs", () => ({
  windowId: "test-window-id",
}));

import { getWsUrl, useProjectWebSocket } from "./use-project-websocket";

const invalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "user-1" } } }) },
}));

it("refreshes resource links when another client updates a task", () => {
  const sockets: FakeWebSocket[] = [];
  class FakeWebSocket {
    onmessage: ((event: { data: string }) => void) | null = null;
    close = vi.fn();
    constructor() {
      sockets.push(this);
    }
  }
  vi.stubGlobal("WebSocket", FakeWebSocket);
  try {
    renderHook(() => useProjectWebSocket("project-1"));
    sockets[0].onmessage?.({
      data: JSON.stringify({
        type: "TASK_UPDATED",
        projectId: "project-1",
        taskId: "task-1",
      }),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["external-links", "task-1"],
    });
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});

describe("getWsUrl", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "http://localhost:1337");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
});
