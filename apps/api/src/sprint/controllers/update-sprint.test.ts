import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockSprintFindFirst = vi.fn();
const mockNameClashSelect = vi.fn();
const mockUpdate = vi.fn();
const mockPublishEvent = vi.fn();
const mockGetSprint = vi.fn();

vi.mock("../../database", () => ({
  default: {
    query: {
      sprintTable: { findFirst: (args: unknown) => mockSprintFindFirst(args) },
    },
    // The rename-clash check reads via select().from().where().limit(1).
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => mockNameClashSelect() }),
      }),
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

import updateSprint from "./update-sprint";

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
  mockNameClashSelect.mockReset();
  mockUpdate.mockReset();
  mockPublishEvent.mockReset();
  mockGetSprint.mockReset();
});
describe("updateSprint", () => {
  it("updates only the fields that are provided", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockUpdate.mockResolvedValueOnce([{ ...futureSprint, goal: "New goal" }]);
    const updated = { id: "sprint-1", goal: "New goal", taskCount: 0 };
    mockGetSprint.mockResolvedValueOnce(updated);

    const result = await updateSprint("sprint-1", { goal: "New goal" });

    expect(result).toBe(updated);
    expect(Object.keys(mockUpdate.mock.calls[0][0])).toEqual(["goal"]);
    expect(mockPublishEvent).toHaveBeenCalledWith("sprint.updated", {
      projectId: "project-1",
      sprintId: "sprint-1",
    });
  });

  it("rejects an unknown sprint with 404", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      updateSprint("missing", { goal: "New goal" }),
    ).rejects.toMatchObject({
      status: 404,
      message: "Sprint not found",
    });
  });

  it("rejects editing a closed sprint with 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      status: "closed",
    });

    await expect(
      updateSprint("sprint-1", { name: "Renamed" }),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "Closed sprints are immutable. Their tasks stay as the history of what was implemented.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects moving the start date of the active sprint with 400", async () => {
    mockSprintFindFirst.mockResolvedValueOnce({
      ...futureSprint,
      status: "active",
      startDate: new Date("2025-01-15T00:00:00.000Z"),
    });

    await expect(
      updateSprint("sprint-1", { startDate: "2025-02-01" }),
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Only future sprints can change their start date; the active sprint is already running",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("moves the start date of a future sprint within a valid range", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockUpdate.mockResolvedValueOnce([{ ...futureSprint }]);
    mockGetSprint.mockResolvedValueOnce({ id: "sprint-1" });

    await updateSprint("sprint-1", {
      startDate: "2025-02-01",
      endDate: "2025-02-15",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      startDate: new Date("2025-02-01"),
      endDate: new Date("2025-02-15"),
    });
  });

  it("clears the end date when null is sent", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockUpdate.mockResolvedValueOnce([{ ...futureSprint }]);
    mockGetSprint.mockResolvedValueOnce({ id: "sprint-1" });

    await updateSprint("sprint-1", { endDate: null });

    expect(mockUpdate).toHaveBeenCalledWith({ endDate: null });
  });

  it("rejects renaming to a name that already exists with 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockNameClashSelect.mockResolvedValueOnce([{ id: "sprint-2" }]);

    await expect(
      updateSprint("sprint-1", { name: "Sprint 2" }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Sprint "Sprint 2" already exists in this project',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("skips the clash check when the name does not change", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockUpdate.mockResolvedValueOnce([{ ...futureSprint }]);
    mockGetSprint.mockResolvedValueOnce({ id: "sprint-1" });

    await updateSprint("sprint-1", { name: "Sprint 1", goal: "Same name" });

    expect(mockNameClashSelect).not.toHaveBeenCalled();
  });

  it("maps a concurrent rename racing the clash check to 409", async () => {
    mockSprintFindFirst.mockResolvedValueOnce(futureSprint);
    mockNameClashSelect.mockResolvedValueOnce([]);
    mockUpdate.mockRejectedValueOnce(
      uniqueViolation("sprint_project_name_unique"),
    );

    await expect(
      updateSprint("sprint-1", { name: "Sprint 2" }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Sprint "Sprint 2" already exists in this project',
    });
  });
});
