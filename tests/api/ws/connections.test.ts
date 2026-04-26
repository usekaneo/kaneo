import { afterEach, describe, expect, it, vi } from "vitest";

// We need to mock the events module to prevent side effects from the
// top-level subscribeToEvent calls in ws/index.ts
vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

import {
  addConnection,
  removeConnection,
} from "../../../apps/api/src/ws/index";

function makeFakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    raw: undefined,
    url: null,
    protocol: null,
  } as never;
}

// We access projectConnections indirectly through the exported functions.
// After each test we clean up by removing all connections we added.
const tracked: Array<{
  projectId: string;
  conn: ReturnType<typeof addConnection>;
}> = [];

afterEach(() => {
  for (const { projectId, conn } of tracked) {
    removeConnection(projectId, conn);
  }
  tracked.length = 0;
});

function trackAdd(projectId: string, userId: string, initiatorId: string) {
  const conn = addConnection(projectId, makeFakeWs(), userId, initiatorId);
  tracked.push({ projectId, conn });
  return conn;
}

describe("addConnection / removeConnection", () => {
  it("returns a ProjectConnection object with the provided values", () => {
    const ws = makeFakeWs();
    const conn = addConnection("proj-1", ws, "user-1", "init-1");
    tracked.push({ projectId: "proj-1", conn });

    expect(conn).toEqual({
      ws,
      userId: "user-1",
      initiatorId: "init-1",
    });
  });

  it("allows multiple connections for the same project", () => {
    const c1 = trackAdd("proj-1", "user-1", "init-1");
    const c2 = trackAdd("proj-1", "user-2", "init-2");

    expect(c1).not.toBe(c2);
    // Both should be removable without error
    removeConnection("proj-1", c1);
    removeConnection("proj-1", c2);
    // Remove from tracked since we manually cleaned up
    tracked.length = 0;
  });

  it("allows connections to different projects", () => {
    const c1 = trackAdd("proj-1", "user-1", "init-1");
    const c2 = trackAdd("proj-2", "user-1", "init-1");

    expect(c1).not.toBe(c2);
  });

  it("removeConnection does not throw for unknown project", () => {
    const conn = trackAdd("proj-1", "user-1", "init-1");
    // Remove from a project that doesn't match — should not throw
    expect(() => removeConnection("nonexistent", conn)).not.toThrow();
  });

  it("removeConnection does not throw for already-removed connection", () => {
    const conn = trackAdd("proj-1", "user-1", "init-1");
    removeConnection("proj-1", conn);
    tracked.length = 0;
    // Second removal should be a no-op
    expect(() => removeConnection("proj-1", conn)).not.toThrow();
  });
});
