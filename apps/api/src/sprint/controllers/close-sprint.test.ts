import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockSprintFindFirst = vi.fn();
const mockMoveTasks = vi.fn();
const mockFreezeSprint = vi.fn();
const mockPublishEvent = vi.fn();
const mockGetSprint = vi.fn();

vi.mock("../../database", () => ({
  default: {
    query: {
      sprintTable: { findFirst: (args: unknown) => mockSprintFindFirst(args) },
    },
    // The transaction hands the controller a tx with the two update chains
    // closeSprint runs: the unfinished-task move (with .returning()) and the
    // sprint freeze (awaited directly on .where()). The two are told apart by
    // the values they set, which is all the assertions need.
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        update: (table: unknown) => ({
          set: (values: Record<string, unknown>) => ({
            where: () => {
              if ("sprintId" in values) {
                expect(table).toBeTruthy();
                return { returning: () => mockMoveTasks(values) };
              }
              return mockFreezeSprint(values);
            },
          }),
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

import closeSprint from "./close-sprint";

beforeEach(() => {
  mockSprintFindFirst.mockReset();
  mockMoveTasks.mockReset();
  mockFreezeSprint.mockReset();
  mockFreezeSprint.mockResolvedValue(undefined);
  mockPublishEvent.mockReset();
  mockGetSprint.mockReset();
});

const activeSprint = {
  id: "sprint-1",
  projectId: "project-1",
  name: "Sprint 1",
  goal: null,
  status: "active",
  startDate: new Date("2025-01-15T00:00:00.000Z"),
  endDate: new Date("2025-01-29T00:00:00.000Z"),
  position: 1,
  carryOverTasks: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

describe("closeSprint", () => {
  it("closes the active sprint and moves unfinished tasks to the target sprint", async () => {
    mockSprintFindFirst
      .mockResolvedValueOnce(activeSprint)
      .mockResolvedValueOnce({
        ...activeSprint,
        id: "sprint-2",
        name: "Sprint 2",
        status: "future",
      });
    mockMoveTasks.mockResolvedValueOnce([
      { id: "task-1", title: "Polish the board" },
      { id: "task-2", title: "Ship the export" },
    ]);
    const closed = { id: "sprint-1", status: "closed", taskCount: 2 };
    mockGetSprint.mockResolvedValueOnce(closed);

    const result = await closeSprint("sprint-1", "sprint-2");

    expect(result).toEqual({
      sprint: closed,
      movedTaskIds: ["task-1", "task-2"],
      targetSprintId: "sprint-2",
    });
    expect(mockMoveTasks).toHaveBeenCalledWith({ sprintId: "sprint-2" });
    expect(mockFreezeSprint).toHaveBeenCalledWith({
      status: "closed",
      carryOverTasks: [
        { id: "task-1", title: "Polish the board" },
        { id: "task-2", title: "Ship the export" },
      ],
    });
    expect(mockPublishEvent).toHaveBeenCalledWith("sprint.updated", {
      projectId: "project-1",
      sprintId: "sprint-1",
    });
  });

  it("moves unfinished tasks to the backlog when no target sprint is given", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(activeSprint);
    mockMoveTasks.mockResolvedValueOnce([
      { id: "task-1", title: "Polish the board" },
    ]);
    mockGetSprint.mockResolvedValueOnce({ id: "sprint-1", status: "closed" });

    const result = await closeSprint("sprint-1", null);

    expect(result.targetSprintId).toBeNull();
    expect(result.movedTaskIds).toEqual(["task-1"]);
    expect(mockMoveTasks).toHaveBeenCalledWith({ sprintId: null });
  });

  it("rejects an unknown sprint with 404", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(undefined);

    await expect(closeSprint("missing", null)).rejects.toMatchObject({
      status: 404,
      message: "Sprint not found",
    });
    expect(mockMoveTasks).not.toHaveBeenCalled();
  });

  it("rejects closing a future sprint with 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce({
      ...activeSprint,
      status: "future",
    });

    await expect(closeSprint("sprint-1", null)).rejects.toMatchObject({
      status: 409,
      message: "Only the active sprint can be closed",
    });
  });

  it("rejects closing an already closed sprint with 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce({
      ...activeSprint,
      status: "closed",
    });

    await expect(closeSprint("sprint-1", null)).rejects.toMatchObject({
      status: 409,
      message: "Sprint is already closed",
    });
  });

  it("rejects a target sprint from another project with 404", async () => {
    mockSprintFindFirst
      .mockResolvedValueOnce(activeSprint)
      .mockResolvedValueOnce({
        ...activeSprint,
        id: "sprint-2",
        projectId: "project-2",
        status: "future",
      });

    await expect(closeSprint("sprint-1", "sprint-2")).rejects.toMatchObject({
      status: 404,
      message: "Target sprint not found in this project",
    });
    expect(mockMoveTasks).not.toHaveBeenCalled();
  });

  it("rejects a target sprint that is not a future sprint with 400", async () => {
    mockSprintFindFirst
      .mockResolvedValueOnce(activeSprint)
      .mockResolvedValueOnce({
        ...activeSprint,
        id: "sprint-2",
        status: "active",
      });

    await expect(closeSprint("sprint-1", "sprint-2")).rejects.toMatchObject({
      status: 400,
      message: "Unfinished tasks can only move to a future sprint",
    });
  });
});
