import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NotFound } from "../../../apps/api/src/effect/errors";
import {
  makeTestDatabase,
  makeTestEvents,
} from "../../../apps/api/src/effect/testing";
import createTimeEntry from "../../../apps/api/src/time-entry/controllers/create-time-entry";
import updateTimeEntry from "../../../apps/api/src/time-entry/controllers/update-time-entry";
import { InvalidTimeRange } from "../../../apps/api/src/time-entry/errors";

const START = new Date("2026-08-10T10:00:00.000Z");
const END = new Date("2026-08-10T11:00:00.000Z");

const ENTRY = {
  id: "time-entry-1",
  taskId: "task-1",
  userId: "user-1",
  description: "",
  startTime: START,
  endTime: END,
  duration: 3600,
  createdAt: START,
  updatedAt: START,
};

function failureOf(effect: Effect.Effect<unknown, unknown>) {
  return Effect.runPromise(effect).then(
    () => {
      throw new Error("expected the effect to fail");
    },
    (error: unknown) => error,
  );
}

function selectReturning(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => Promise.resolve(rows),
  };
  return () => chain;
}

function insertReturning(rows: unknown[]) {
  return () => ({
    values: () => ({ returning: () => Promise.resolve(rows) }),
  });
}

describe("time-entry controllers through the Effect test layers", () => {
  it("updateTimeEntry fails with NotFound for a missing entry", async () => {
    const database = makeTestDatabase({ select: selectReturning([]) });

    const error = await failureOf(
      Effect.provide(
        updateTimeEntry({ timeEntryId: "missing", startTime: START }),
        database,
      ),
    );

    expect(error).toBeInstanceOf(NotFound);
    expect(error).toMatchObject({ entity: "Time entry", id: "missing" });
  });

  it("updateTimeEntry fails with InvalidTimeRange before writing", async () => {
    let updated = false;
    const database = makeTestDatabase({
      select: selectReturning([ENTRY]),
      update: () => {
        updated = true;
        throw new Error("must not update");
      },
    });

    const error = await failureOf(
      Effect.provide(
        updateTimeEntry({
          timeEntryId: ENTRY.id,
          startTime: new Date("2026-08-10T12:00:00.000Z"),
        }),
        database,
      ),
    );

    expect(error).toBeInstanceOf(InvalidTimeRange);
    expect(updated).toBe(false);
  });

  it("createTimeEntry publishes time-entry.created with the task owner", async () => {
    const database = makeTestDatabase({
      insert: insertReturning([ENTRY]),
      select: selectReturning([{ userId: "owner-1", title: "Write docs" }]),
    });
    const events = makeTestEvents();

    const result = await Effect.runPromise(
      Effect.provide(
        createTimeEntry({
          taskId: "task-1",
          userId: "user-1",
          startTime: START,
          endTime: END,
        }),
        Layer.mergeAll(database, events.layer),
      ),
    );

    expect(result).toEqual(ENTRY);
    expect(events.published).toEqual([
      {
        type: "time-entry.created",
        data: {
          timeEntryId: "time-entry-1",
          taskId: "task-1",
          userId: "user-1",
          type: "create",
          content: "started time tracking",
          taskOwnerId: "owner-1",
          taskTitle: "Write docs",
        },
      },
    ]);
  });
});
