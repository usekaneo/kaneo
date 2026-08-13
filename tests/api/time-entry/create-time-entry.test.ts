import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockPublishEvent = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

import createTimeEntry from "../../../apps/api/src/time-entry/controllers/create-time-entry";

function makeInsertMock(createdRow: unknown) {
  const returning = vi.fn(() => Promise.resolve([createdRow]));
  const values = vi.fn(() => ({ returning }));
  return { values, returning };
}

function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

describe("createTimeEntry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("stores the duration in seconds when an endTime is supplied", async () => {
    const startTime = new Date("2026-08-10T10:00:00.000Z");
    const endTime = new Date("2026-08-10T11:00:00.000Z");
    const insertChain = makeInsertMock({
      id: "time-entry-1",
      taskId: "task-1",
      startTime,
      endTime,
      duration: 3600,
    });

    mockInsert.mockReturnValue(insertChain);
    mockSelect.mockReturnValue(
      makeSelectMock([{ userId: "task-owner", title: "Ship the thing" }]),
    );

    await createTimeEntry({
      taskId: "task-1",
      userId: "user-1",
      startTime,
      endTime,
    });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime,
        endTime,
        duration: 3600,
      }),
    );
  });

  it("leaves the duration null for an entry that is still running", async () => {
    const startTime = new Date("2026-08-10T10:00:00.000Z");
    const insertChain = makeInsertMock({
      id: "time-entry-1",
      taskId: "task-1",
      startTime,
      endTime: null,
      duration: null,
    });

    mockInsert.mockReturnValue(insertChain);
    mockSelect.mockReturnValue(
      makeSelectMock([{ userId: "task-owner", title: "Ship the thing" }]),
    );

    await createTimeEntry({
      taskId: "task-1",
      userId: "user-1",
      startTime,
    });

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime,
        endTime: null,
        duration: null,
      }),
    );
  });

  it("rejects a startTime later than the endTime", async () => {
    const insertChain = makeInsertMock({});

    mockInsert.mockReturnValue(insertChain);

    await expect(
      createTimeEntry({
        taskId: "task-1",
        userId: "user-1",
        startTime: new Date("2026-08-10T12:00:00.000Z"),
        endTime: new Date("2026-08-10T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Start time cannot be after end time. Please adjust the time range.",
    });

    expect(insertChain.values).not.toHaveBeenCalled();
  });
});
