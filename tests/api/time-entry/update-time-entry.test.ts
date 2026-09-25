import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (fn: (tx: unknown) => unknown) =>
      fn({ update: (...args: unknown[]) => mockUpdate(...args) }),
  },
}));

import updateTimeEntry from "../../../apps/api/src/time-entry/controllers/update-time-entry";

function makeSelectMock(rows: unknown[]) {
  // Awaitable like a drizzle chain, with limit() for bounded lookups.
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    where: vi.fn(() =>
      Object.assign(Promise.resolve(rows), {
        limit: vi.fn(() => Promise.resolve(rows)),
      }),
    ),
  };
  return chain;
}

function makeUpdateMock(updatedRow: unknown) {
  const returning = vi.fn(() => Promise.resolve([updatedRow]));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  return { set, where, returning };
}

describe("updateTimeEntry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("preserves a stored endTime and duration when endTime is omitted", async () => {
    const storedStartTime = new Date("2026-08-10T10:00:00.000Z");
    const storedEndTime = new Date("2026-08-10T11:00:00.000Z");
    const nextStartTime = new Date("2026-08-10T10:15:00.000Z");
    const updatedRow = {
      id: "time-entry-1",
      startTime: nextStartTime,
      endTime: storedEndTime,
      duration: 2700,
      description: "renamed",
    };
    const updateChain = makeUpdateMock(updatedRow);

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: storedStartTime,
          endTime: storedEndTime,
          duration: 3600,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await updateTimeEntry({
      timeEntryId: "time-entry-1",
      userId: "user-1",
      startTime: nextStartTime,
      description: "renamed",
    });

    expect(updateChain.set).toHaveBeenCalledWith({
      startTime: nextStartTime,
      endTime: storedEndTime,
      duration: 2700,
      description: "renamed",
    });
  });

  it("rejects a startTime later than the preserved endTime", async () => {
    const updateChain = makeUpdateMock({});

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: new Date("2026-08-10T10:00:00.000Z"),
          endTime: new Date("2026-08-10T11:00:00.000Z"),
          duration: 3600,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await expect(
      updateTimeEntry({
        timeEntryId: "time-entry-1",
        userId: "user-1",
        startTime: new Date("2026-08-10T12:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("rejects a startTime later than an endTime supplied in the same update", async () => {
    const updateChain = makeUpdateMock({});

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: new Date("2026-08-10T10:00:00.000Z"),
          endTime: new Date("2026-08-10T11:00:00.000Z"),
          duration: 3600,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await expect(
      updateTimeEntry({
        timeEntryId: "time-entry-1",
        userId: "user-1",
        startTime: new Date("2026-08-10T12:00:00.000Z"),
        endTime: new Date("2026-08-10T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("derives the end time from a duration on an ended entry", async () => {
    const storedStartTime = new Date("2026-08-10T10:00:00.000Z");
    const updateChain = makeUpdateMock({ id: "time-entry-1" });

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: storedStartTime,
          endTime: new Date("2026-08-10T11:00:00.000Z"),
          duration: 3600,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await updateTimeEntry({
      timeEntryId: "time-entry-1",
      userId: "user-2",
      duration: 1800,
      billable: false,
    });

    expect(updateChain.set).toHaveBeenCalledWith({
      startTime: storedStartTime,
      endTime: new Date("2026-08-10T10:30:00.000Z"),
      duration: 1800,
      billable: false,
    });
  });

  it("returns the entry unchanged when nothing changes", async () => {
    const stored = {
      id: "time-entry-1",
      userId: "user-1",
      startTime: new Date("2026-08-10T10:00:00.000Z"),
      endTime: new Date("2026-08-10T11:00:00.000Z"),
      duration: 3600,
    };
    const updateChain = makeUpdateMock(stored);

    mockSelect.mockReturnValue(makeSelectMock([stored]));
    mockUpdate.mockReturnValue(updateChain);

    const result = await updateTimeEntry({
      timeEntryId: "time-entry-1",
      userId: "user-1",
    });

    expect(result).toEqual(stored);
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("prefers duration over a conflicting endTime", async () => {
    const updateChain = makeUpdateMock({ id: "time-entry-1" });

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: new Date("2026-08-10T10:00:00.000Z"),
          endTime: new Date("2026-08-10T11:00:00.000Z"),
          duration: 3600,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await updateTimeEntry({
      timeEntryId: "time-entry-1",
      userId: "user-1",
      endTime: new Date("2026-08-10T12:00:00.000Z"),
      duration: 1800,
    });

    expect(updateChain.set).toHaveBeenCalledWith({
      startTime: new Date("2026-08-10T10:00:00.000Z"),
      endTime: new Date("2026-08-10T10:30:00.000Z"),
      duration: 1800,
    });
  });

  it("lets the owner adjust notes on a running entry", async () => {
    const updateChain = makeUpdateMock({ id: "time-entry-1" });

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: new Date("2026-08-10T10:00:00.000Z"),
          endTime: null,
          duration: null,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await updateTimeEntry({
      timeEntryId: "time-entry-1",
      userId: "user-1",
      description: "still working",
      billable: false,
    });

    expect(updateChain.set).toHaveBeenCalledWith({
      description: "still working",
      billable: false,
    });
  });

  it("rejects timestamp changes on a running entry", async () => {
    const updateChain = makeUpdateMock({});

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: new Date("2026-08-10T10:00:00.000Z"),
          endTime: null,
          duration: null,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await expect(
      updateTimeEntry({
        timeEntryId: "time-entry-1",
        userId: "user-1",
        startTime: new Date("2026-08-10T12:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("rejects edits to another user's running entry", async () => {
    const updateChain = makeUpdateMock({});

    mockSelect.mockReturnValue(
      makeSelectMock([
        {
          id: "time-entry-1",
          userId: "user-1",
          startTime: new Date("2026-08-10T10:00:00.000Z"),
          endTime: null,
          duration: null,
        },
      ]),
    );
    mockUpdate.mockReturnValue(updateChain);

    await expect(
      updateTimeEntry({
        timeEntryId: "time-entry-1",
        userId: "user-2",
        description: "hijack",
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(updateChain.set).not.toHaveBeenCalled();
  });
});
