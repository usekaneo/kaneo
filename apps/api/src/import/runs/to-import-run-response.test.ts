import { describe, expect, it } from "vite-plus/test";
import { pendingRunProject } from "../import-run-project";
import {
  INTERRUPTED_RUN_ERROR,
  type ImportRunRow,
  isStaleRun,
  toImportRunResponse,
} from "./to-import-run-response";

const createdAt = new Date("2026-10-01T10:00:00.000Z");

function row(overrides: Partial<ImportRunRow> = {}): ImportRunRow {
  return {
    id: "run-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    source: "planka",
    status: "running",
    includeComments: true,
    message: "Reading cards (20 of 80)",
    projects: [
      { ...pendingRunProject("a", "Alpha"), status: "completed" },
      { ...pendingRunProject("b", "Beta"), status: "running" },
      pendingRunProject("c", "Gamma"),
    ],
    error: null,
    heartbeatAt: new Date("2026-10-01T10:05:00.000Z"),
    createdAt,
    finishedAt: null,
    ...overrides,
  };
}

describe("toImportRunResponse", () => {
  it("returns a fresh running run as it is, without the user", () => {
    const now = new Date("2026-10-01T10:06:00.000Z");
    const response = toImportRunResponse(row(), now);

    expect(response).toEqual({
      id: "run-1",
      workspaceId: "workspace-1",
      source: "planka",
      status: "running",
      includeComments: true,
      message: "Reading cards (20 of 80)",
      error: null,
      projects: row().projects,
      createdAt,
      finishedAt: null,
    });
    expect(response).not.toHaveProperty("userId");
  });

  it("reports a running run with a stale heartbeat as interrupted", () => {
    const now = new Date("2026-10-01T10:07:01.000Z");
    const response = toImportRunResponse(row(), now);

    expect(response.status).toBe("failed");
    expect(response.error).toBe(INTERRUPTED_RUN_ERROR);
    expect(response.message).toBeNull();
    expect(response.finishedAt).toEqual(row().heartbeatAt);
    expect(response.projects.map((project) => project.status)).toEqual([
      "completed",
      "failed",
      "failed",
    ]);
    expect(response.projects[1]?.error).toBe(INTERRUPTED_RUN_ERROR);
    expect(response.projects[0]?.error).toBeNull();
  });

  it("leaves finished runs alone however old their heartbeat is", () => {
    const finishedAt = new Date("2026-10-01T10:05:00.000Z");
    const response = toImportRunResponse(
      row({ status: "completed", message: null, finishedAt }),
      new Date("2026-10-09T00:00:00.000Z"),
    );

    expect(response.status).toBe("completed");
    expect(response.error).toBeNull();
    expect(response.finishedAt).toEqual(finishedAt);
  });

  it("treats an unknown stored status as failed", () => {
    expect(toImportRunResponse(row({ status: "paused" })).status).toBe(
      "failed",
    );
  });
});

describe("isStaleRun", () => {
  it("allows two minutes of silence", () => {
    const heartbeatAt = new Date("2026-10-01T10:00:00.000Z");
    expect(
      isStaleRun(
        { status: "running", heartbeatAt },
        new Date("2026-10-01T10:02:00.000Z"),
      ),
    ).toBe(false);
    expect(
      isStaleRun(
        { status: "running", heartbeatAt },
        new Date("2026-10-01T10:02:00.001Z"),
      ),
    ).toBe(true);
  });
});
