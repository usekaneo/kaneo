import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { pendingRunProject } from "../import-run-project";
import { markStaleRuns } from "./mark-stale-runs";
import type { ImportRunRow } from "./to-import-run-response";

const mocks = vi.hoisted(() => ({
  updates: [] as string[],
  failFor: new Set<string>(),
  logImportError: vi.fn(),
}));

vi.mock("../../database", () => ({
  default: {
    update: () => ({
      set: (values: { status?: string }) => ({
        where: async () => {
          const id = mocks.updates.length === 0 ? "first" : "next";
          mocks.updates.push(values.status ?? "");
          if (mocks.failFor.has(id)) throw new Error("connection reset");
        },
      }),
    }),
  },
}));

vi.mock("../log-import-error", () => ({
  logImportError: mocks.logImportError,
}));

const now = new Date("2026-10-01T10:10:00.000Z");

function row(overrides: Partial<ImportRunRow> = {}): ImportRunRow {
  return {
    id: "run-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    source: "planka",
    status: "running",
    includeComments: true,
    message: null,
    projects: [pendingRunProject("a", "Alpha")],
    error: null,
    heartbeatAt: new Date("2026-10-01T10:00:00.000Z"),
    createdAt: new Date("2026-10-01T09:59:00.000Z"),
    finishedAt: null,
    ...overrides,
  };
}

describe("markStaleRuns", () => {
  beforeEach(() => {
    mocks.updates = [];
    mocks.failFor = new Set();
    mocks.logImportError.mockReset();
  });

  it("marks stale running runs as failed and skips fresh ones", async () => {
    await markStaleRuns(
      [row(), row({ id: "run-2", heartbeatAt: new Date(now) })],
      now,
    );

    expect(mocks.updates).toEqual(["failed"]);
    expect(mocks.logImportError).not.toHaveBeenCalled();
  });

  it("logs a failed repair instead of throwing", async () => {
    mocks.failFor.add("first");

    await expect(markStaleRuns([row()], now)).resolves.toBeUndefined();

    expect(mocks.logImportError).toHaveBeenCalledWith(
      "Failed to mark a stale import run",
      "run-1",
      expect.any(Error),
    );
  });
});
