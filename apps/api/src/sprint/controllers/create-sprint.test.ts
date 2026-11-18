import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockPublishEvent = vi.fn();
const mockGetSprint = vi.fn();

vi.mock("../../database", () => ({
  default: {
    // createSprint first reads the project's sprints, then the max position.
    select: (selection: Record<string, unknown>) => ({
      from: () => ({ where: () => mockSelect(selection) }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: () => mockInsert(values),
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

import createSprint from "./create-sprint";

function uniqueViolation(constraint: string) {
  return Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint,
  });
}

beforeEach(() => {
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockPublishEvent.mockReset();
  mockGetSprint.mockReset();
});

describe("createSprint", () => {
  it("creates the next future sprint at the end of the list", async () => {
    mockSelect
      .mockResolvedValueOnce([{ id: "s1", name: "Sprint 1" }])
      .mockResolvedValueOnce([{ maxPosition: 2 }]);
    mockInsert.mockResolvedValueOnce([
      { id: "s2", projectId: "project-1", name: "Sprint 2" },
    ]);
    const created = { id: "s2", name: "Sprint 2", taskCount: 0 };
    mockGetSprint.mockResolvedValueOnce(created);
    mockPublishEvent.mockResolvedValueOnce(undefined);

    const result = await createSprint({
      projectId: "project-1",
      goal: "Ship the backlog view",
      startDate: "2025-01-15",
      endDate: "2025-01-29",
    });

    expect(result).toBe(created);
    expect(mockInsert).toHaveBeenCalledWith({
      projectId: "project-1",
      name: "Sprint 2",
      goal: "Ship the backlog view",
      status: "future",
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-01-29"),
      position: 3,
    });
    expect(mockPublishEvent).toHaveBeenCalledWith("sprint.updated", {
      projectId: "project-1",
      sprintId: "s2",
    });
  });

  it("rejects a name that already exists in the project with 409", async () => {
    mockSelect.mockResolvedValueOnce([{ id: "s1", name: "Release 1.0" }]);

    await expect(
      createSprint({ projectId: "project-1", name: "Release 1.0" }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Sprint "Release 1.0" already exists in this project',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("maps a concurrent duplicate-name insert to 409 instead of a 500", async () => {
    mockSelect
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ maxPosition: -1 }]);
    mockInsert.mockRejectedValueOnce(
      uniqueViolation("sprint_project_name_unique"),
    );

    await expect(
      createSprint({ projectId: "project-1", name: "Sprint 1" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rethrows insert errors that are not name conflicts", async () => {
    mockSelect
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ maxPosition: -1 }]);
    mockInsert.mockRejectedValueOnce(new Error("connection reset"));

    await expect(
      createSprint({ projectId: "project-1" }),
    ).rejects.toMatchObject({ message: "connection reset" });
  });

  it("rejects an unparseable start date with 400", async () => {
    await expect(
      createSprint({ projectId: "project-1", startDate: "not-a-date" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects a start date after the end date with 400", async () => {
    await expect(
      createSprint({
        projectId: "project-1",
        startDate: "2025-02-01",
        endDate: "2025-01-15",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Start date cannot be after due date. Please adjust the date range.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("fails loudly when the insert returns no row", async () => {
    mockSelect
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ maxPosition: -1 }]);
    mockInsert.mockResolvedValueOnce([]);

    await expect(
      createSprint({ projectId: "project-1" }),
    ).rejects.toMatchObject({ status: 500, message: "Failed to create sprint" });
  });
});
