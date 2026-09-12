import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { getWsUrl, useProjectWebSocket } from "./use-project-websocket";

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

type Socket = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

describe("useProjectWebSocket message handling", () => {
  let socket: Socket;
  let invalidate: ReturnType<typeof vi.fn>;

  function mount() {
    const client = new QueryClient();
    invalidate = vi.fn();
    client.invalidateQueries = invalidate;

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

  // The project-scoped relations query is what the list view reads, and no
  // per-task key reaches it.
  it.each(["TASK_RELATION_UPDATED", "TASK_DELETED", "TASK_MOVED"])(
    "refreshes the project relations on %s",
    (type) => {
      receive({ type, projectId: "project-1", taskId: "task-1" });

      expect(invalidatedKeys()).toContain(projectRelationsKey);
    },
  );

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
