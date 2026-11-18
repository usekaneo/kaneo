import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockSprintFindFirst = vi.fn();
const mockProjectFindFirst = vi.fn();
const mockActiveSprintSelect = vi.fn();
const mockUpdate = vi.fn();
const mockPublishEvent = vi.fn();
const mockGetSprint = vi.fn();

vi.mock("../../database", () => ({
  default: {
    query: {
      sprintTable: { findFirst: (args: unknown) => mockSprintFindFirst(args) },
      projectTable: {
        findFirst: (args: unknown) => mockProjectFindFirst(args),
      },
    },
    // The single-active-sprint guard reads via select().from().where().limit(1).
    select: () => ({
      from: () => ({ where: () => ({ limit: () => mockActiveSprintSelect() }) }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({ returning: () => mockUpdate(values) }),
      }),
    }),
  },
}));

vi.mock("../../events", () => ({ publishEvent: mockPublishEvent }));

vi.mock("./get-sprints", () => ({
  getSprint: mockGetSprint,
  getSprintList: vi.fn(),
  default: vi.fn(),
}));

import startSprint from "./start-sprint";

const futureSprint = {
  id: "sprint-1",
  projectId: "project-1",
  name: "Sprint 1",
  goal: null,
  status: "future",
  startDate: null,
  endDate: null,
  position: 1,
  carryOverTasks: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

function uniqueViolation(constraint: string) {
  return Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint,
  });
}

beforeEach(() => {
  mockSprintFindFirst.mockReset();
  mockProjectFindFirst.mockReset();
  mockActiveSprintSelect.mockReset();
  mockUpdate.mockReset();
  mockPublishEvent.mockReset();
  mockGetSprint.mockReset();
});

describe("startSprint", () => {
  it("starts a future sprint and derives the end date from the project default length", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockActiveSprintSelect.mockResolvedValueOnce([]);
    mockProjectFindFirst.mockResolvedValueOnce({
      id: "project-1",
      defaultSprintLengthDays: 21,
    });
    mockUpdate.mockResolvedValueOnce([
      { ...futureSprint, status: "active" },
    ]);
    const started = { id: "sprint-1", status: "active", taskCount: 0 };
    mockGetSprint.mockResolvedValueOnce(started);

    const result = await startSprint("sprint-1", {
      startDate: "2025-01-15",
    });

    expect(result).toBe(started);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "active",
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-02-05"),
    });
    expect(mockPublishEvent).toHaveBeenCalledWith("sprint.updated", {
      projectId: "project-1",
      sprintId: "sprint-1",
    });
  });

  it("keeps explicit dates and the stored defaults", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockActiveSprintSelect.mockResolvedValueOnce([]);
    mockProjectFindFirst.mockResolvedValueOnce(null);
    mockUpdate.mockResolvedValueOnce([{ ...futureSprint, status: "active" }]);
    mockGetSprint.mockResolvedValueOnce({ id: "sprint-1" });

    await startSprint("sprint-1", {
      startDate: "2025-01-15",
      endDate: "2025-01-20",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      status: "active",
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-01-20"),
    });
  });

  it("rejects a start date after the end date with 400", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockActiveSprintSelect.mockResolvedValueOnce([]);

    await expect(
      startSprint("sprint-1", {
        startDate: "2025-01-20",
        endDate: "2025-01-15",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Start date cannot be after due date. Please adjust the date range.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an unknown sprint with 404", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(undefined);

    await expect(startSprint("missing", {})).rejects.toMatchObject({
      status: 404,
      message: "Sprint not found",
    });
  });

  it("rejects starting an already active sprint with 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      status: "active",
    });

    await expect(startSprint("sprint-1", {})).rejects.toMatchObject({
      status: 409,
      message: "Sprint is already active",
    });
  });

  it("rejects restarting a closed sprint with 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      status: "closed",
    });

    await expect(startSprint("sprint-1", {})).rejects.toMatchObject({
      status: 409,
      message: "Closed sprints cannot be restarted",
    });
  });

  it("rejects starting while another sprint is active with 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockActiveSprintSelect.mockResolvedValueOnce([
      { id: "sprint-2", name: "Sprint 2" },
    ]);

    await expect(startSprint("sprint-1", {})).rejects.toMatchObject({
      status: 409,
      message:
        'Sprint "Sprint 2" is already active. Close it before starting another sprint.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("maps a concurrent start racing the active-sprint guard to 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockActiveSprintSelect.mockResolvedValueOnce([]);
    mockProjectFindFirst.mockResolvedValueOnce(null);
    mockUpdate.mockRejectedValueOnce(uniqueViolation("sprint_project_active_unique"));

    await expect(startSprint("sprint-1", {})).rejects.toMatchObject({
      status: 409,
      message:
        "Another sprint is already active. Close it before starting another sprint.",
    });
  });
});
